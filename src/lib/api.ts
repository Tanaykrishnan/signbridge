import { NextResponse } from 'next/server';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { assets } from './catalog';
import { pageSchema, translateSchema, type Pagination, type Translation } from './schemas';
import { dataDirectory, getStore } from './store';
import { fingerspellingProvider } from './translation';
import { LocalIslProvider } from './isl-translation';
import { ActiveIslMotionProvider, activeIslModelStatus } from './isl-local-model';
import { ISL_REFERENCE_PHRASES } from './isl-reference';
import { ASL_SIGNS, ASL_REPEAT_SIGNS, ASL_PAUSE } from './asl-alphabet';
import { phrasePlayback } from './phrase-playback';
import { runSigningPipeline, type SigningInput } from './signing-pipeline';
import { ParaphraseError } from './paraphrase';
import { saveParaphrase } from './paraphrase-store';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function secret() {
  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32)
      throw new ApiError(503, 'SESSION_SECRET must contain at least 32 characters.');
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV === 'production')
    throw new ApiError(503, 'Guest storage requires SESSION_SECRET in production.');
  await fs.mkdir(dataDirectory(), { recursive: true });
  const file = path.join(dataDirectory(), '.session-secret');
  try {
    await fs.writeFile(file, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
  }
  return fs.readFile(file, 'utf8');
}
export async function session(req: Request) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_MODE !== 'true')
    throw new ApiError(
      503,
      'Guest demo mode is disabled. Configure authentication or explicitly enable guest mode.',
    );
  const key = await secret();
  const sign = (s: string) => createHmac('sha256', key).update(s).digest('hex');
  const token = req.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('sb_guest='))
    ?.slice(9);
  if (token) {
    const [id, signature] = token.split('.');
    if (
      z.uuid().safeParse(id).success &&
      signature?.length === 64 &&
      /^[a-f0-9]+$/.test(signature) &&
      timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(sign(id), 'hex'))
    )
      return { id, cookie: null };
  }
  const id = randomUUID();
  return {
    id,
    cookie: `sb_guest=${id}.${sign(id)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`,
  };
}
export async function body(req: Request) {
  if (!req.headers.get('content-type')?.includes('application/json'))
    throw new ApiError(415, 'Send application/json.');
  const reader = req.body?.getReader();
  let raw = '';
  let size = 0;
  const decoder = new TextDecoder();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        throw new ApiError(413, 'Request body is too large.');
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, 'Invalid JSON.');
  }
}
function paginate<T>(items: T[], p: Pagination) {
  return {
    items: items.slice((p.page - 1) * p.limit, p.page * p.limit),
    total: items.length,
    page: p.page,
    limit: p.limit,
  };
}
const rates = new Map<string, { count: number; until: number }>();
const localIslProvider = new LocalIslProvider(undefined, new ActiveIslMotionProvider());
type Input = z.infer<typeof translateSchema>;
const receiptSchema = z
  .object({
    hash: z.string().length(64),
    expires: z.number().int(),
    status: z.enum(['supported', 'unsupported']),
    outputMode: z.enum(['isl', 'asl-fingerspelling']),
    phraseId: z.string().nullable(),
  })
  .strict();
function inputHash(input: Input) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        input.text,
        input.language,
        input.outputMode,
        input.allowReferencePreview,
        input.allowUnreviewedModel,
      ]),
    )
    .digest('hex');
}
async function signReceipt(input: Input, result: Translation) {
  const payload = Buffer.from(
    JSON.stringify({
      hash: inputHash(input),
      expires: Date.now() + 900000,
      status: result.status,
      outputMode: result.outputMode ?? input.outputMode,
      phraseId: result.phrase?.id ?? null,
    }),
  ).toString('base64url');
  return `${payload}.${createHmac('sha256', await secret())
    .update(`history.v1.${payload}`)
    .digest('hex')}`;
}
async function readReceipt(token: string, input: Input) {
  const [payload, signature, extra] = token.split('.');
  const expected = createHmac('sha256', await secret())
    .update(`history.v1.${payload}`)
    .digest();
  if (
    extra ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    !timingSafeEqual(expected, Buffer.from(signature, 'hex'))
  )
    throw new ApiError(400, 'Invalid translation receipt. Translate again before saving.');
  let parsed;
  try {
    parsed = receiptSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
  } catch {
    throw new ApiError(400, 'Invalid translation receipt.');
  }
  if (parsed.expires < Date.now() || parsed.hash !== inputHash(input))
    throw new ApiError(
      400,
      'Translation receipt expired or does not match this input. Translate again.',
    );
  return parsed;
}
export async function api(req: Request, resource: string, id?: string): Promise<Response> {
  try {
    const mutation = !['GET', 'HEAD'].includes(req.method);
    if (mutation) {
      const origin = req.headers.get('origin');
      const requestUrl = new URL(req.url);
      // Next may reconstruct req.url with its internal hostname; Host is the browser's destination.
      const expectedOrigin =
        process.env.APP_ORIGIN ||
        `${requestUrl.protocol}//${req.headers.get('host') || requestUrl.host}`;
      if (origin && origin !== expectedOrigin)
        throw new ApiError(403, 'Cross-origin mutations are not allowed.');
    }
    const store = getStore();
    const url = new URL(req.url);
    const params = () => pageSchema.parse(Object.fromEntries(url.searchParams));
    let cookie: string | null = null;
    const respond = (data: unknown, status = 200) => {
      const res = NextResponse.json(data, { status });
      res.headers.set(
        'Cache-Control',
        process.env.NODE_ENV === 'production' && ['phrases', 'assets'].includes(resource)
          ? 'public, max-age=60, stale-while-revalidate=300'
          : 'no-store',
      );
      if (cookie) res.headers.set('Set-Cookie', cookie);
      return res;
    };
    let guestId: string | undefined;
    const processSigning = async (input: SigningInput) => {
      const result = await runSigningPipeline(
        input,
        async (text, options, signal) =>
          options.outputMode === 'asl-fingerspelling'
            ? fingerspellingProvider.translate(text, options.language)
            : localIslProvider.translate(
                text,
                options.language,
                await store.phrases(),
                await store.signs(),
                { ...options, signal },
              ),
        req.signal,
      );
      if (result.paraphrase && guestId) {
        try {
          await saveParaphrase(guestId, result.paraphrase);
          result.paraphrase.persistence = 'saved-local';
        } catch {
          result.paraphrase.persistence = 'not-saved';
        }
      }
      return result;
    };
    if (mutation || ['history', 'favorites'].includes(resource)) {
      const guest = await session(req);
      guestId = guest.id;
      cookie = guest.cookie;
      if (mutation) {
        const now = Date.now();
        if (rates.size > 10000) for (const [k, v] of rates) if (v.until < now) rates.delete(k);
        const entry = rates.get(guest.id);
        if (entry && entry.until > now) {
          if (entry.count++ >= 120)
            throw new ApiError(429, 'Too many requests. Try again in a minute.');
        } else rates.set(guest.id, { count: 1, until: now + 60000 });
      }
    }
    if (resource === 'capabilities')
      return respond({
        targetLanguage: 'ISL',
        model: await activeIslModelStatus(),
        arbitraryTextGuaranteed: false,
        referencePreviewCount: ISL_REFERENCE_PHRASES.length,
        maxTextLength: 5000,
      });
    if (resource === 'health') {
      await store.phrases();
      return respond({
        status: 'ok',
        storage: store.mode,
        mode: 'guest-demo',
        reviewedAssets: (await store.signs()).filter(
          (sign) => sign.review === 'reviewed' && sign.available,
        ).length,
        version: '1.0.0',
        islModel: (await activeIslModelStatus()).state,
      });
    }
    if (resource === 'assets')
      return respond({
        ...assets,
        avatar: { ...assets.avatar, url: process.env.NEXT_PUBLIC_AVATAR_URL || assets.avatar.url },
        signs: [...(await store.signs()), ...ASL_SIGNS, ...ASL_REPEAT_SIGNS, ASL_PAUSE],
      });
    if (resource === 'phrases') {
      let phrases = await store.phrases();
      if (id) {
        const p = phrases.find((x) => x.id === id);
        if (!p) throw new ApiError(404, 'Phrase not found.');
        return respond(p);
      }
      const p = params();
      const signs = await store.signs();
      phrases = phrases.filter(
        (x) =>
          (!p.q || x.text.toLowerCase().includes(p.q.toLowerCase())) &&
          (!p.category || x.category === p.category) &&
          (!p.review || x.review === p.review) &&
          (!p.available || String(phrasePlayback(x, signs).state === 'ready') === p.available),
      );
      return respond(paginate(phrases, p));
    }
    if (resource === 'translate') {
      const input = translateSchema.parse(await body(req));
      const result = await processSigning(input);
      return respond({ ...result, historyReceipt: await signReceipt(input, result) });
    }
    const guest = { id: guestId! };
    if (resource === 'history') {
      if (req.method === 'GET') {
        const p = params();
        return respond(
          paginate(
            (await store.history(guest.id)).filter(
              (h) =>
                (!p.q || h.sourceText.toLowerCase().includes(p.q.toLowerCase())) &&
                (!p.status || h.status === p.status),
            ),
            p,
          ),
        );
      }
      if (req.method === 'DELETE' && id) {
        if (!(await store.deleteHistory(guest.id, id)))
          throw new ApiError(404, 'History entry not found.');
        return respond({ deleted: true });
      }
      const input = translateSchema
        .extend({ historyReceipt: z.string().min(1).max(4096).optional() })
        .parse(await body(req));
      if (input.historyReceipt) {
        const receipt = await readReceipt(input.historyReceipt, input);
        return respond(
          await store.addHistory(
            guest.id,
            input.text,
            receipt.phraseId,
            receipt.status,
            receipt.outputMode,
          ),
          201,
        );
      }
      const { historyReceipt: unusedReceipt, ...signingInput } = input;
      void unusedReceipt;
      const result = await processSigning(signingInput);
      return respond(
        await store.addHistory(
          guest.id,
          input.text,
          result.phrase?.id ?? null,
          result.status,
          result.outputMode ?? input.outputMode,
        ),
        201,
      );
    }
    if (resource === 'favorites') {
      if (req.method === 'GET') return respond(paginate(await store.favorites(guest.id), params()));
      if (req.method === 'DELETE' && id) {
        if (!(await store.deleteFavorite(guest.id, id)))
          throw new ApiError(404, 'Favorite not found.');
        return respond({ deleted: true });
      }
      const { phraseId } = z
        .object({ phraseId: z.string().min(1).max(100) })
        .strict()
        .parse(await body(req));
      if (!(await store.phrases()).some((p) => p.id === phraseId))
        throw new ApiError(404, 'Phrase not found.');
      return respond(await store.addFavorite(guest.id, phraseId), 201);
    }
    throw new ApiError(404, 'Endpoint not found.');
  } catch (error) {
    if (error instanceof ParaphraseError)
      return NextResponse.json(
        { error: error.message, stage: 'paraphrase' },
        { status: error.status },
      );
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid input.' },
        { status: 400 },
      );
    if (error instanceof ApiError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[SignBridge API]', error);
    return NextResponse.json(
      { error: 'Storage or configuration is unavailable. Check the server logs.' },
      { status: 503 },
    );
  }
}
