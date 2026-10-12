import { IslModelError, type IslModelState, type IslMotionProvider } from './isl-motion-schema';

const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 60000;

type ModelEnvironment = Record<string, string | undefined>;
function configuration(env: ModelEnvironment) {
  if (!env.ISL_MODEL_URL?.trim()) return null;
  const url = new URL(env.ISL_MODEL_URL);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.hash ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
  )
    throw new Error('Use HTTPS or a local loopback HTTP endpoint, without embedded credentials.');
  return { url: url.toString(), token: env.ISL_MODEL_TOKEN };
}

export function islModelStatus(env: ModelEnvironment = process.env): {
  state: IslModelState;
  message: string;
} {
  try {
    return configuration(env)
      ? {
          state: 'configured',
          message:
            'Model endpoint configured. Availability and motion are checked on each request; accuracy is not certified.',
        }
      : {
          state: 'not-configured',
          message:
            'No English-to-ISL motion model is installed. Arbitrary sentences cannot be signed yet. ASL is never substituted.',
        };
  } catch {
    return {
      state: 'misconfigured',
      message:
        'ISL model configuration is invalid. Check the server environment and model integration documentation.',
    };
  }
}

export class HttpIslMotionProvider implements IslMotionProvider {
  private static active = 0;
  constructor(
    private env: ModelEnvironment = process.env,
    private transport: typeof fetch = fetch,
    private timeoutMs = TIMEOUT_MS,
  ) {}
  async generate(text: string, language: string, signal?: AbortSignal): Promise<unknown | null> {
    let config;
    try {
      config = configuration(this.env);
    } catch {
      throw new IslModelError('model-unavailable', islModelStatus(this.env).message);
    }
    if (!config) return null;
    if (HttpIslMotionProvider.active >= 2)
      throw new IslModelError(
        'model-unavailable',
        'The ISL model is busy. Retry shortly; no substitute motion was generated.',
      );
    HttpIslMotionProvider.active++;
    const abort = AbortSignal.timeout(this.timeoutMs);
    try {
      const response = await this.transport(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
        },
        body: JSON.stringify({
          version: 1,
          sourceText: text,
          sourceLanguage: language,
          targetLanguage: 'ISL',
          skeleton: 'signbridge-v1',
        }),
        signal: signal ? AbortSignal.any([signal, abort]) : abort,
        redirect: 'error',
        cache: 'no-store',
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new IslModelError(
          'model-unavailable',
          'The ISL model could not process this input. No substitute animation was generated.',
        );
      }
      if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
        await response.body?.cancel();
        throw new IslModelError(
          'model-output-invalid',
          'The ISL model returned a non-JSON response.',
        );
      }
      const reader = response.body?.getReader();
      if (!reader)
        throw new IslModelError('model-output-invalid', 'The ISL model returned no motion data.');
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let raw = '';
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_RESPONSE_BYTES)
            throw new IslModelError(
              'model-output-invalid',
              'ISL motion response exceeds the 8 MiB safety limit.',
            );
          raw += decoder.decode(value, { stream: true });
        }
        raw += decoder.decode();
        return JSON.parse(raw);
      } catch (error) {
        await reader.cancel().catch(() => {});
        if (error instanceof IslModelError) throw error;
        if (abort.aborted || signal?.aborted) throw error;
        throw new IslModelError(
          'model-output-invalid',
          'The ISL model returned invalid JSON motion data.',
        );
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof IslModelError) throw error;
      throw new IslModelError(
        'model-unavailable',
        abort.aborted
          ? 'ISL generation timed out after waiting for the model. No substitute animation was generated.'
          : 'The configured ISL model is unreachable. Start the model service and retry.',
      );
    } finally {
      HttpIslMotionProvider.active--;
    }
  }
}
