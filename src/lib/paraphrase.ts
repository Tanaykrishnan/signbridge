import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { buildParaphrasePrompt, checkFidelity, countWords } from './paraphrase-prompts';
import {
  generatedParaphraseSchema,
  PARAPHRASE_LIMIT,
  type ParaphraseResult,
  type ParaphraseStatus,
  type PromptStrategy,
} from './paraphrase-schema';

export class ParaphraseError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function config() {
  const raw = process.env.PARAPHRASE_MODEL_URL || 'http://127.0.0.1:8081/v1';
  const url = new URL(raw);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  )
    throw new Error(
      'Use a loopback HTTP or HTTPS model endpoint without credentials or query parameters.',
    );
  return {
    base: url.href.replace(/\/$/, ''),
    model: process.env.PARAPHRASE_MODEL_NAME || 'signbridge-qwen2.5-1.5b',
  };
}
function headers(base: string) {
  let token = process.env.PARAPHRASE_MODEL_TOKEN;
  if (!token && base === 'http://127.0.0.1:8081/v1') {
    try {
      token = readFileSync(path.join(process.cwd(), '.local-ai/server.key'), 'utf8').trim();
    } catch {}
  }
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
export async function paraphraseStatus(): Promise<ParaphraseStatus> {
  let settings;
  try {
    settings = config();
  } catch {
    return {
      state: 'misconfigured',
      model: 'Unknown',
      provider: 'OpenAI-compatible model server',
      inputLimit: PARAPHRASE_LIMIT,
      message: 'Check PARAPHRASE_MODEL_URL in the server environment.',
    };
  }
  const status = {
    model: settings.model,
    provider: 'OpenAI-compatible model server',
    inputLimit: PARAPHRASE_LIMIT,
  };
  try {
    const response = await fetch(`${settings.base}/models`, {
      headers: headers(settings.base),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(3000),
    });
    const data = z
      .object({ data: z.array(z.object({ id: z.string() })) })
      .parse(await response.json());
    if (!response.ok || !data.data.some((m) => m.id === settings.model))
      throw new Error('Model not loaded');
    return { ...status, state: 'ready', message: 'Model loaded and available for inference.' };
  } catch {
    return {
      ...status,
      state: 'offline',
      message: 'Start the local model with pnpm ai:start, then refresh status.',
    };
  }
}
const completionSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string() }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .min(1),
  usage: z
    .object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() })
    .optional(),
});
let active = false;
export async function generateParaphrase(
  text: string,
  strategy: PromptStrategy,
  signal?: AbortSignal,
): Promise<ParaphraseResult> {
  if (active)
    throw new ParaphraseError(
      429,
      'The local model is processing another request. Try again after it finishes.',
    );
  active = true;
  const start = performance.now();
  try {
    let settings;
    try {
      settings = config();
    } catch {
      throw new ParaphraseError(503, 'The paraphrasing model configuration is invalid.');
    }
    const prompt = buildParaphrasePrompt(text, strategy);
    const response = await fetch(`${settings.base}/chat/completions`, {
      method: 'POST',
      headers: headers(settings.base),
      redirect: 'error',
      cache: 'no-store',
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(180000)])
        : AbortSignal.timeout(180000),
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        temperature: 0,
        seed: 42,
        max_tokens: 2200,
        stream: false,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'EnglishParaphrase',
            strict: true,
            schema: z.toJSONSchema(generatedParaphraseSchema),
          },
        },
      }),
    });
    if (!response.ok)
      throw new ParaphraseError(
        502,
        'The language model rejected this request. Check the local model log.',
      );
    const reader = response.body?.getReader();
    if (!reader) throw new ParaphraseError(502, 'The model returned an empty response.');
    const decoder = new TextDecoder();
    let raw = '';
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 128000) {
        await reader.cancel();
        throw new ParaphraseError(502, 'Model response exceeded the allowed size.');
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const completion = completionSchema.parse(JSON.parse(raw));
    if (completion.choices[0].finish_reason === 'length')
      throw new ParaphraseError(
        502,
        'The model reached its output limit. Split the paragraph into shorter sections.',
      );
    const generated = generatedParaphraseSchema.parse(
      JSON.parse(completion.choices[0].message.content),
    );
    const inputWords = countWords(text);
    const outputWords = countWords(generated.paraphrase);
    return {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      sourceText: text,
      paraphrase: generated.paraphrase,
      strategy,
      prompt,
      model: {
        id: completion.model || settings.model,
        provider: 'OpenAI-compatible inference',
        source:
          settings.model === 'signbridge-qwen2.5-1.5b'
            ? 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF'
            : 'Operator-configured model service',
        license:
          settings.model === 'signbridge-qwen2.5-1.5b'
            ? 'Apache-2.0'
            : 'Not supplied by the operator',
      },
      metrics: {
        latencyMs: Math.round(performance.now() - start),
        inputWords,
        outputWords,
        wordChangePercent: Math.round(((outputWords - inputWords) / inputWords) * 100),
        promptTokens: completion.usage?.prompt_tokens ?? null,
        completionTokens: completion.usage?.completion_tokens ?? null,
      },
      checks: checkFidelity(text, generated.paraphrase),
      semanticReview: 'required',
      outputKind: 'english-paraphrase',
    };
  } catch (error) {
    if (error instanceof ParaphraseError) throw error;
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      throw new ParaphraseError(
        502,
        'The model returned an invalid result. No generated output was accepted.',
      );
    if (signal?.aborted) throw new ParaphraseError(499, 'Generation cancelled.');
    if ((error as Error).name === 'TimeoutError')
      throw new ParaphraseError(504, 'Local generation timed out. Try a shorter input.');
    throw new ParaphraseError(
      503,
      'The language model is offline. Run pnpm ai:start in a separate terminal.',
    );
  } finally {
    active = false;
  }
}
