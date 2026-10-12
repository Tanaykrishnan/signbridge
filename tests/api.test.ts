import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { api } from '../src/lib/api';
import { LocalFileStore } from '../src/lib/store';
import { testMotion } from './fixtures/isl-motion';
let directory: string;
let cookie = '';
let historyId = '';
let favoriteId = '';
const original = {
  database: process.env.DATABASE_URL,
  dir: process.env.LOCAL_DATA_DIR,
  secret: process.env.SESSION_SECRET,
  model: process.env.ISL_MODEL_URL,
  paraphraseUrl: process.env.PARAPHRASE_MODEL_URL,
  paraphraseModel: process.env.PARAPHRASE_MODEL_NAME,
};
let paraphraseCalls = 0;
let paraphraseFails = false;
// Synthetic English responses test transport/order only, not model quality.
const textServer = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  paraphraseCalls++;
  res.setHeader('Content-Type', 'application/json');
  if (paraphraseFails) {
    res.statusCode = 503;
    res.end('{}');
    return;
  }
  expect(input.messages[0].content).toContain('Preserve every request and fact');
  const source = input.messages[1].content.slice(
    '<source_text>\n'.length,
    -'\n</source_text>'.length,
  );
  const output = source.startsWith('Could you please tell me where the library')
    ? 'Where is the library?'
    : source;
  res.end(
    JSON.stringify({
      model: 'test-text-transport',
      choices: [
        { message: { content: JSON.stringify({ paraphrase: output }) }, finish_reason: 'stop' },
      ],
    }),
  );
});
function req(url: string, method = 'GET', data?: unknown, guest = cookie) {
  return new Request('http://localhost:3000/api/' + url, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: guest, Origin: 'http://localhost:3000' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
beforeAll(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'signbridge-api-'));
  delete process.env.DATABASE_URL;
  delete process.env.ISL_MODEL_URL;
  process.env.LOCAL_DATA_DIR = directory;
  process.env.SESSION_SECRET = 'test-secret-at-least-thirty-two-characters';
  await new Promise<void>((resolve) => textServer.listen(0, '127.0.0.1', resolve));
  const address = textServer.address();
  if (!address || typeof address === 'string') throw new Error('Text test server did not start');
  process.env.PARAPHRASE_MODEL_URL = `http://127.0.0.1:${address.port}/v1`;
  process.env.PARAPHRASE_MODEL_NAME = 'test-text-transport';
});
afterAll(async () => {
  textServer.closeAllConnections();
  await new Promise<void>((resolve) => textServer.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
  for (const [key, value] of Object.entries({
    DATABASE_URL: original.database,
    LOCAL_DATA_DIR: original.dir,
    SESSION_SECRET: original.secret,
    ISL_MODEL_URL: original.model,
    PARAPHRASE_MODEL_URL: original.paraphraseUrl,
    PARAPHRASE_MODEL_NAME: original.paraphraseModel,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
describe('validated API and durable local persistence', () => {
  it('enforces generated-English signing and saves receipts without rerunning paraphrasing', async () => {
    const input = {
      text: 'Could you please tell me where the library is?',
      outputMode: 'asl-fingerspelling',
    };
    const before = paraphraseCalls;
    const response = await api(req('translate', 'POST', input), 'translate');
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.sourceText).toBe('Where is the library?');
    expect(result.originalSourceText).toBe(input.text);
    expect(result.paraphrase.strategy).toBe('constrained');
    expect(result.paraphrase.persistence).toBe('saved-local');
    const saved = await api(
      req('history', 'POST', { ...input, historyReceipt: result.historyReceipt }),
      'history',
    );
    expect((await saved.json()).sourceText).toBe(input.text);
    expect(paraphraseCalls - before).toBe(1);
  });
  it('cannot bypass the mandatory model when it fails, including history writes', async () => {
    paraphraseFails = true;
    try {
      for (const resource of ['translate', 'history']) {
        const response = await api(
          req(resource, 'POST', { text: 'Hello', outputMode: 'asl-fingerspelling' }),
          resource,
        );
        expect(response.status).toBe(502);
        expect((await response.json()).stage).toBe('paraphrase');
      }
    } finally {
      paraphraseFails = false;
    }
    expect(
      (await api(req('translate', 'POST', { text: 'Hello', skipParaphrase: true }), 'translate'))
        .status,
    ).toBe(400);
  });
  it('uses a real loopback HTTP transport and saves model results without duplicate inference (synthetic motion only)', async () => {
    let calls = 0;
    const server = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      calls++;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(testMotion(input.sourceText)));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    process.env.ISL_MODEL_URL = `http://127.0.0.1:${address.port}/v1/translate`;
    try {
      const input = {
        text: 'Arbitrary paragraph to exercise transport. Synthetic, not an ISL translation.',
        outputMode: 'isl',
        allowUnreviewedModel: true,
      };
      const response = await api(req('translate', 'POST', input), 'translate');
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.rendering).toBe('isl-model-motion');
      expect(result.generatedMotion.model.id).toBe('synthetic-test-fixture');
      const saved = await api(
        req('history', 'POST', { ...input, historyReceipt: result.historyReceipt }),
        'history',
      );
      expect(saved.status).toBe(201);
      expect((await saved.json()).status).toBe('supported');
      expect(calls).toBe(1);
    } finally {
      delete process.env.ISL_MODEL_URL;
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
  it('translates supported and unsupported inputs', async () => {
    const res = await api(req('translate', 'POST', { text: 'hello' }), 'translate');
    expect(res.status).toBe(200);
    expect((await res.json()).phrase.id).toBe('hello');
    const bad = await api(req('translate', 'POST', { text: 'random unknown words' }), 'translate');
    expect((await bad.json()).status).toBe('unsupported');
  });
  it('converts and persists long ASL input with its output mode', async () => {
    const text = 'Where can I find the Kattankulathur Student Services Centre? '.repeat(15);
    const response = await api(
      req('translate', 'POST', { text, outputMode: 'asl-fingerspelling' }),
      'translate',
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.targetLanguage).toBe('ASL');
    expect(result.playback).toBe('ready');
    expect(result.sequence.length).toBeGreaterThan(500);
    const saved = await api(
      req('history', 'POST', { text, outputMode: 'asl-fingerspelling' }, ''),
      'history',
    );
    expect(saved.status).toBe(201);
    expect((await saved.json()).outputMode).toBe('asl-fingerspelling');
  });
  it('exposes previews and annotations without ever falling back to ASL', async () => {
    const preview = await (
      await api(
        req('translate', 'POST', { text: 'Hello', allowReferencePreview: true }),
        'translate',
      )
    ).json();
    expect(preview.rendering).toBe('isl-reference-preview');
    expect(preview.sequence[0].clip).toBe('isl-reference-hello');
    const input = {
      text: 'Are you free today?',
      outputMode: 'isl',
    };
    const result = await (await api(req('translate', 'POST', input), 'translate')).json();
    expect(result.datasetMatch.gloss).toBe('YOU FREE TODAY');
    expect(result.targetLanguage).toBe('ISL');
    expect(result.sequence).toEqual([]);
    const saved = await api(req('history', 'POST', input, ''), 'history');
    expect((await saved.json()).outputMode).toBe('isl');
    expect(
      (
        await api(
          req('translate', 'POST', { ...input, fallback: 'asl-fingerspelling' }),
          'translate',
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await api(
          req('translate', 'POST', { text: 'Hi', allowReferencePreview: 'true' }),
          'translate',
        )
      ).status,
    ).toBe(400);
  });
  it('saves signed results without reprocessing and rejects tampered or mismatched receipts', async () => {
    const input = { text: 'Hello', allowReferencePreview: true };
    const response = await api(req('translate', 'POST', input), 'translate');
    const result = await response.json();
    const saved = await api(
      req('history', 'POST', { ...input, historyReceipt: result.historyReceipt }),
      'history',
    );
    expect(saved.status).toBe(201);
    expect((await saved.json()).status).toBe('supported');
    for (const data of [
      { ...input, text: 'Different input', historyReceipt: result.historyReceipt },
      { ...input, historyReceipt: result.historyReceipt + 'bad' },
      { ...input, allowReferencePreview: false, historyReceipt: result.historyReceipt },
    ])
      expect((await api(req('history', 'POST', data), 'history')).status).toBe(400);
  });
  it('publishes accurate capability status without credentials or false availability', async () => {
    const result = await (await api(req('capabilities'), 'capabilities')).json();
    expect(result.model.state).toBe('not-configured');
    expect(result.arbitraryTextGuaranteed).toBe(false);
    expect(result.referencePreviewCount).toBe(7);
    expect(JSON.stringify(result)).not.toContain('ISL_MODEL_TOKEN');
  });
  it('validates request bodies, languages, content types, and origin', async () => {
    for (const data of [
      { text: '' },
      { text: 'x'.repeat(5001) },
      { text: 'hello', language: 'hi' },
    ])
      expect((await api(req('translate', 'POST', data), 'translate')).status).toBe(400);
    expect(
      (
        await api(
          new Request('http://localhost:3000/api/translate', { method: 'POST', body: 'hello' }),
          'translate',
        )
      ).status,
    ).toBe(415);
    expect(
      (
        await api(
          new Request('http://localhost:3000/api/translate', {
            method: 'POST',
            headers: { Origin: 'https://evil.example' },
            body: '{}',
          }),
          'translate',
        )
      ).status,
    ).toBe(403);
  });
  it('filters, paginates and exposes phrase details', async () => {
    const result = await (await api(req('phrases?category=greetings&limit=2'), 'phrases')).json();
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(6);
    expect((await api(req('phrases/hello'), 'phrases', 'hello')).status).toBe(200);
    expect((await api(req('phrases/missing'), 'phrases', 'missing')).status).toBe(404);
    expect((await api(req('phrases?limit=999'), 'phrases')).status).toBe(400);
  });
  it('uses the browser-facing host for same-origin requests', async () => {
    const request = new Request('http://localhost:3000/api/translate', {
      method: 'POST',
      headers: {
        Host: '127.0.0.1:3000',
        Origin: 'http://127.0.0.1:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'Hello' }),
    });
    expect((await api(request, 'translate')).status).toBe(200);
  });
  it('persists scoped history and rejects tampered sessions', async () => {
    const r = await api(req('history', 'POST', { text: 'hello' }, ''), 'history');
    expect(r.status).toBe(201);
    cookie = r.headers.get('set-cookie')!.split(';')[0];
    historyId = (await r.json()).id;
    expect((await (await api(req('history'), 'history')).json()).total).toBe(1);
    const fresh = await (
      await api(req('history', 'GET', undefined, cookie + 'bad'), 'history')
    ).json();
    expect(fresh.total).toBe(0);
    expect(
      (await new LocalFileStore(directory).history(cookie.split('=')[1].split('.')[0])).length,
    ).toBe(1);
  });
  it('deduplicates favorites and enforces ownership for removal', async () => {
    const r = await api(req('favorites', 'POST', { phraseId: 'hello' }), 'favorites');
    favoriteId = (await r.json()).id;
    await api(req('favorites', 'POST', { phraseId: 'hello' }), 'favorites');
    expect((await (await api(req('favorites'), 'favorites')).json()).total).toBe(1);
    expect(
      (await api(req('favorites/' + favoriteId, 'DELETE', undefined, ''), 'favorites', favoriteId))
        .status,
    ).toBe(404);
    expect(
      (await api(req('favorites/' + favoriteId, 'DELETE'), 'favorites', favoriteId)).status,
    ).toBe(200);
    expect((await api(req('history/' + historyId, 'DELETE'), 'history', historyId)).status).toBe(
      200,
    );
  });
  it('refreshes local fixtures without deleting guest records', async () => {
    const store = new LocalFileStore(directory);
    const record = await store.addHistory('sync-test-guest', 'Hello', 'hello', 'supported');
    await store.syncCatalog();
    expect((await store.history('sync-test-guest'))[0].id).toBe(record.id);
    expect((await store.phrases()).length).toBeGreaterThan(0);
  });
});
