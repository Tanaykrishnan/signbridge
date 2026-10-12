import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildParaphrasePrompt, checkFidelity } from '../src/lib/paraphrase-prompts';
import { paraphraseInputSchema } from '../src/lib/paraphrase-schema';
import { generateParaphrase, paraphraseStatus } from '../src/lib/paraphrase';
import { POST, GET } from '../src/app/api/paraphrase/route';

// Synthetic text responses test transport and validation, not model quality.
let mode = 'valid';
const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url?.endsWith('/models')) {
    res.end(JSON.stringify({ data: [{ id: 'test-language-model' }] }));
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(body.response_format.type).toBe('json_schema');
  const text =
    mode === 'invalid' ? 'not-json' : JSON.stringify({ paraphrase: 'Where is room 205 tomorrow?' });
  res.end(
    JSON.stringify({
      model: 'test-language-model',
      choices: [
        { message: { content: text }, finish_reason: mode === 'truncated' ? 'length' : 'stop' },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 9 },
    }),
  );
});
const original = {
  url: process.env.PARAPHRASE_MODEL_URL,
  name: process.env.PARAPHRASE_MODEL_NAME,
  dir: process.env.LOCAL_DATA_DIR,
  secret: process.env.SESSION_SECRET,
};
let dir = '';
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'signbridge-paraphrase-'));
  process.env.LOCAL_DATA_DIR = dir;
  process.env.SESSION_SECRET = 'paraphrase-test-secret-at-least-thirty-two-characters';
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test transport did not start');
  process.env.PARAPHRASE_MODEL_URL = `http://127.0.0.1:${address.port}/v1`;
  process.env.PARAPHRASE_MODEL_NAME = 'test-language-model';
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(dir, { recursive: true, force: true });
  for (const [key, value] of Object.entries({
    PARAPHRASE_MODEL_URL: original.url,
    PARAPHRASE_MODEL_NAME: original.name,
    LOCAL_DATA_DIR: original.dir,
    SESSION_SECRET: original.secret,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
function request(text: string, origin = 'http://localhost:3000', cookie = '') {
  return new Request('http://localhost:3000/api/paraphrase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify({ text }),
  });
}
describe('English generation and explicit fidelity limits', () => {
  it('rejects empty, oversized and non-English-symbol-only input', () => {
    for (const text of ['', ' '.repeat(10), 'a'.repeat(5001), '12345'])
      expect(paraphraseInputSchema.safeParse({ text }).success).toBe(false);
  });
  it('builds different prompts without embedding evaluation inputs as examples', () => {
    const a = buildParaphrasePrompt('Novel campus query', 'zero-shot');
    const b = buildParaphrasePrompt('Novel campus query', 'few-shot');
    const c = buildParaphrasePrompt('Novel campus query', 'constrained');
    expect(a.system).not.toBe(b.system);
    expect(b.system).not.toBe(c.system);
    expect(c.system).toContain('Keep negation');
    expect(c.user).toContain('Novel campus query');
  });
  it('flags removed names, time, numeric details and negation without asserting accuracy', () => {
    const checks = checkFidelity(
      'Do not visit the SRM Central Library at 14:30 tomorrow?',
      'Visit the library.',
    );
    for (const label of [
      'Numbers',
      'Time words',
      'Negation cue',
      'Abbreviations',
      'Name candidates',
      'Question cue',
    ])
      expect(checks.find((c) => c.label === label)?.status).toBe('warning');
    expect(
      checkFidelity('I do not need help today.', 'Today I do not need help.').find(
        (c) => c.label === 'Negation cue',
      )?.detail,
    ).toContain('scope still needs review');
  });
  it('makes real HTTP transport calls, records provenance, and rejects malformed/truncated responses', async () => {
    expect((await paraphraseStatus()).state).toBe('ready');
    const result = await generateParaphrase('Where can I find room 205 tomorrow?', 'constrained');
    expect(result.paraphrase).toBe('Where is room 205 tomorrow?');
    expect(result.semanticReview).toBe('required');
    expect(result.outputKind).toBe('english-paraphrase');
    expect(result.model.license).toBe('Not supplied by the operator');
    mode = 'invalid';
    await expect(generateParaphrase('Hello', 'zero-shot')).rejects.toMatchObject({ status: 502 });
    mode = 'truncated';
    await expect(generateParaphrase('Hello', 'zero-shot')).rejects.toMatchObject({ status: 502 });
    mode = 'valid';
  });
  it('validates API inputs and origins and scopes persisted model results to signed guest cookies', async () => {
    expect((await POST(request(''))).status).toBe(400);
    expect((await POST(request('Hello', 'https://example.com'))).status).toBe(403);
    const accepted = await POST(request('Where can I find room 205 tomorrow?'));
    expect(accepted.status).toBe(200);
    const result = await accepted.json();
    expect(result.persistence).toBe('saved-local');
    const cookie = accepted.headers.get('set-cookie')!.split(';')[0];
    const history = await GET(
      new Request('http://localhost:3000/api/paraphrase', { headers: { Cookie: cookie } }),
    );
    expect((await history.json()).items[0].id).toBe(result.id);
    const stranger = await GET(new Request('http://localhost:3000/api/paraphrase'));
    expect((await stranger.json()).items).toHaveLength(0);
  });
  it('reports an offline model with no synthetic success fallback', async () => {
    const prior = process.env.PARAPHRASE_MODEL_URL;
    process.env.PARAPHRASE_MODEL_URL = 'http://127.0.0.1:1/v1';
    expect((await paraphraseStatus()).state).toBe('offline');
    await expect(generateParaphrase('Hello', 'constrained')).rejects.toMatchObject({ status: 503 });
    process.env.PARAPHRASE_MODEL_URL = prior;
  });
});
