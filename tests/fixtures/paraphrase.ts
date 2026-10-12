import { buildParaphrasePrompt, checkFidelity, countWords } from '../../src/lib/paraphrase-prompts';
import type { ParaphraseResult } from '../../src/lib/paraphrase-schema';

// Deterministic test text only. Never installed as an application model or fallback.
export function testParaphrase(source: string, output: string): ParaphraseResult {
  return {
    id: 'test-only-paraphrase',
    createdAt: new Date().toISOString(),
    sourceText: source,
    paraphrase: output,
    strategy: 'constrained',
    prompt: buildParaphrasePrompt(source, 'constrained'),
    model: {
      id: 'synthetic-text-fixture',
      provider: 'test-only',
      source: 'test fixture',
      license: 'Original test fixture',
    },
    metrics: {
      latencyMs: 1,
      inputWords: countWords(source),
      outputWords: countWords(output),
      wordChangePercent: 0,
      promptTokens: null,
      completionTokens: null,
    },
    checks: checkFidelity(source, output),
    semanticReview: 'required',
    outputKind: 'english-paraphrase',
  };
}
