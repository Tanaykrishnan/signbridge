import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { HttpIslMotionProvider, islModelStatus } from './isl-model';
import { IslModelError, type IslCapabilities, type IslMotionProvider } from './isl-motion-schema';
import { retargetResearchOutput } from './isl-retarget';

const healthSchema = z.object({
  ready: z.literal(true),
  engine: z.literal('local-sign-vqvae'),
  vocabularySize: z.number().int().min(1).max(100000),
  review: z.literal('unreviewed'),
  commercialUse: z.literal(false),
});
const endpoint = 'http://127.0.0.1:8082';
export function localIslFailure(status: number, raw: unknown) {
  const issue = z
    .object({
      error: z.string().max(2000),
      code: z.string().optional(),
      unsupportedWords: z.array(z.string().min(1).max(5000)).max(5000).optional(),
    })
    .safeParse(raw);
  return new IslModelError(
    status === 422 && issue.success
      ? issue.data.code === 'vocabulary-unavailable'
        ? 'model-vocabulary-unavailable'
        : 'model-input-unsupported'
      : 'model-unavailable',
    issue.success ? issue.data.error : 'The local decoder could not process this text.',
    issue.success && status === 422 && issue.data.code === 'vocabulary-unavailable'
      ? issue.data.unsupportedWords
      : undefined,
  );
}
async function localKey() {
  if (process.env.NODE_ENV !== 'development' || process.env.ISL_LOCAL_RESEARCH === '0') return null;
  try {
    const key = (await readFile(path.join(process.cwd(), '.local-isl/server.key'), 'utf8')).trim();
    return /^[a-f0-9]{64}$/.test(key) ? key : null;
  } catch {
    return null;
  }
}
async function readBoundedJson(response: Response) {
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new IslModelError(
      'model-output-invalid',
      'The local decoder returned a non-JSON response.',
    );
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty decoder response');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8 * 1024 * 1024)
        throw new IslModelError(
          'model-output-invalid',
          'Motion exceeds 8 MiB. Split your text into shorter sections.',
        );
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function activeIslModelStatus(): Promise<IslCapabilities['model']> {
  if (process.env.ISL_MODEL_URL) return islModelStatus();
  const key = await localKey();
  if (!key) return islModelStatus();
  try {
    const response = await fetch(`${endpoint}/health`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(2000),
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Local health check failed');
    const status = healthSchema.parse(await readBoundedJson(response));
    return {
      state: 'configured',
      engine: status.engine,
      vocabularySize: status.vocabularySize,
      message: `Local research decoder online: ${status.vocabularySize.toLocaleString('en')} ISL sign classes. Experimental grammar and retargeting, not reviewed interpretation. Unknown vocabulary is reported without fingerspelling. Commercial asset permissions are not established.`,
    };
  } catch {
    return {
      state: 'misconfigured',
      engine: 'local-sign-vqvae',
      message:
        'The installed local ISL research engine is offline. Run npm run isl:start. Reference previews remain available.',
    };
  }
}

export class ActiveIslMotionProvider implements IslMotionProvider {
  private remote = new HttpIslMotionProvider();
  get scope() {
    return process.env.ISL_MODEL_URL ? undefined : ('local-research' as const);
  }
  async generate(text: string, language: string, signal?: AbortSignal) {
    if (process.env.ISL_MODEL_URL) return this.remote.generate(text, language, signal);
    const key = await localKey();
    if (!key || language !== 'en') return null;
    try {
      const response = await fetch(`${endpoint}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ sourceText: text }),
        redirect: 'error',
        cache: 'no-store',
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(90000)])
          : AbortSignal.timeout(90000),
      });
      const raw = await readBoundedJson(response);
      if (!response.ok) {
        throw localIslFailure(response.status, raw);
      }
      try {
        return retargetResearchOutput(raw);
      } catch {
        throw new IslModelError(
          'model-output-invalid',
          'Local ISL pose validation or retargeting failed. No motion was substituted.',
        );
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof IslModelError) throw error;
      throw new IslModelError(
        'model-unavailable',
        'The local ISL research engine is offline or timed out. Run npm run isl:start and retry.',
      );
    }
  }
}
