import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = process.env.REVIEW_APP_URL || 'http://127.0.0.1:3000';
const evidence = await fetch(`${origin}/api/review/evidence`).then((r) => r.json());
if (!evidence.scenarios?.length) throw new Error('Start the Next.js app first.');
const samples = [];
let cookie = '';
for (const scenario of evidence.scenarios) {
  for (const strategy of ['zero-shot', 'few-shot', 'constrained']) {
    console.log(`Running ${scenario.id} / ${strategy}`);
    try {
      const response = await fetch(`${origin}/api/paraphrase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
        body: JSON.stringify({ text: scenario.text, strategy }),
        signal: AbortSignal.timeout(185000),
      });
      const nextCookie = response.headers.get('set-cookie');
      if (nextCookie) cookie = nextCookie.split(';')[0];
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      const missingTerms = scenario.required.filter(
        (term) => !result.paraphrase.toLowerCase().includes(term.toLowerCase()),
      );
      samples.push({
        scenarioId: scenario.id,
        objective: scenario.objective,
        requiredTerms: scenario.required,
        missingTerms,
        result,
      });
      console.log(
        `${Math.round(result.metrics.latencyMs)}ms; literal terms ${scenario.required.length - missingTerms.length}/${scenario.required.length}; ${result.paraphrase.slice(0, 130)}`,
      );
    } catch (error) {
      samples.push({
        scenarioId: scenario.id,
        objective: scenario.objective,
        strategy,
        requiredTerms: scenario.required,
        missingTerms: [...scenario.required],
        result: null,
        error: error.message,
      });
      console.log(`FAILED: ${error.message}`);
    }
  }
}
const summaries = ['zero-shot', 'few-shot', 'constrained'].map((strategy) => {
  const group = samples.filter((s) => (s.result?.strategy || s.strategy) === strategy);
  const success = group.filter((s) => s.result);
  return {
    strategy,
    successfulRuns: success.length,
    totalRuns: group.length,
    meanLatencyMs: Math.round(
      success.reduce((sum, s) => sum + s.result.metrics.latencyMs, 0) / Math.max(1, success.length),
    ),
    literalTermsFound: success.reduce(
      (sum, s) => sum + s.requiredTerms.length - s.missingTerms.length,
      0,
    ),
    literalTermsTotal: group.reduce((sum, s) => sum + s.requiredTerms.length, 0),
    heuristicWarnings: success.reduce(
      (sum, s) => sum + s.result.checks.filter((c) => c.status === 'warning').length,
      0,
    ),
  };
});
const report = {
  generatedAt: new Date().toISOString(),
  model: samples.find((s) => s.result)?.result.model.id || 'Unavailable',
  protocol:
    'Five fixed campus, name, paragraph, negation and number scenarios; three prompts per input; temperature 0; seed 42; same JSON schema. Demonstration evaluation, not an independent linguistic benchmark.',
  samples,
  summaries,
  note: 'Literal term retention and heuristic flags do not establish semantic equivalence, accessibility, ISL grammar, or signing accuracy. No ISL motion model was used. These are actual English model outputs, including failures.',
};
await mkdir(path.join(root, 'outputs'), { recursive: true });
await writeFile(path.join(root, 'outputs/review2-evidence.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(summaries, null, 2));
if (samples.some((s) => !s.result)) process.exitCode = 1;
