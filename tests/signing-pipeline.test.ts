import { describe, expect, it, vi } from 'vitest';
import { runSigningPipeline } from '../src/lib/signing-pipeline';
import { translateSchema } from '../src/lib/schemas';
import { fingerspellingProvider } from '../src/lib/translation';
import { LocalIslProvider } from '../src/lib/isl-translation';
import { ParaphraseError } from '../src/lib/paraphrase';
import { testParaphrase } from './fixtures/paraphrase';

describe('mandatory paraphrase-first signing pipeline (synthetic text fixtures)', () => {
  it('signs only generated English and preserves original input and valid token offsets', async () => {
    const source = 'Could you please tell me where the library is?';
    const output = 'Where is the library?';
    const order: string[] = [];
    const generate = vi.fn(async () => {
      order.push('paraphrase');
      return testParaphrase(source, output);
    });
    const result = await runSigningPipeline(
      translateSchema.parse({ text: source, outputMode: 'asl-fingerspelling' }),
      async (text, input) => {
        order.push('sign');
        expect(text).toBe(output);
        return fingerspellingProvider.translate(text, input.language);
      },
      undefined,
      generate,
    );
    expect(order).toEqual(['paraphrase', 'sign']);
    expect(generate).toHaveBeenCalledWith(source, 'constrained', undefined);
    expect(result.originalSourceText).toBe(source);
    expect(result.sourceText).toBe(output);
    expect(result.paraphrase?.paraphrase).toBe(output);
    expect(
      result.sequence
        .filter((s) => s.token?.kind === 'letter')
        .map((s) => s.label)
        .join(''),
    ).toBe('WHEREISTHELIBRARY');
    for (const sign of result.sequence) expect(sign.token!.end).toBeLessThanOrEqual(output.length);
  });
  it('also paraphrases ISL input and never substitutes ASL for missing ISL content', async () => {
    const result = await runSigningPipeline(
      translateSchema.parse({ text: 'Some unknown input' }),
      (text, input) => new LocalIslProvider().translate(text, input.language, [], []),
      undefined,
      async () => testParaphrase('Some unknown input', 'Unknown phrase here'),
    );
    expect(result.targetLanguage).toBe('ISL');
    expect(result.sequence).toEqual([]);
    expect(result.paraphrase?.paraphrase).toBe('Unknown phrase here');
    expect(result.originalSourceText).toBe('Some unknown input');
  });
  it('does not call either signer when the required model is offline', async () => {
    for (const outputMode of ['isl', 'asl-fingerspelling'] as const) {
      const sign = vi.fn();
      await expect(
        runSigningPipeline(
          translateSchema.parse({ text: 'Hello', outputMode }),
          sign,
          undefined,
          async () => {
            throw new ParaphraseError(503, 'Model offline');
          },
        ),
      ).rejects.toThrow('Model offline');
      expect(sign).not.toHaveBeenCalled();
    }
  });
  it('rejects unusable generated text without truncating or invoking signing', async () => {
    for (const output of ['', '1234', 'a'.repeat(5001)]) {
      const sign = vi.fn();
      await expect(
        runSigningPipeline(translateSchema.parse({ text: 'Hello' }), sign, undefined, async () =>
          testParaphrase('Hello', output),
        ),
      ).rejects.toThrow('No text was truncated');
      expect(sign).not.toHaveBeenCalled();
    }
  });
  it('validates before inference and honours cancellation before signing', async () => {
    const sign = vi.fn();
    const generate = vi.fn();
    await expect(
      runSigningPipeline(translateSchema.parse({ text: '12345' }), sign, undefined, generate),
    ).rejects.toThrow();
    expect(generate).not.toHaveBeenCalled();
    const controller = new AbortController();
    await expect(
      runSigningPipeline(
        translateSchema.parse({ text: 'Hello' }),
        sign,
        controller.signal,
        async () => {
          controller.abort();
          return testParaphrase('Hello', 'Hi');
        },
      ),
    ).rejects.toThrow();
    expect(sign).not.toHaveBeenCalled();
  });
  it('surfaces fidelity warnings without calling them verified semantics', async () => {
    const result = await runSigningPipeline(
      translateSchema.parse({ text: 'Do not go tomorrow', outputMode: 'asl-fingerspelling' }),
      (text, input) => fingerspellingProvider.translate(text, input.language),
      undefined,
      async () => testParaphrase('Do not go tomorrow', 'Go today'),
    );
    expect(result.warnings?.join(' ')).toContain('negation cue');
    expect(result.warnings?.join(' ')).toContain('not semantic validation');
    expect(result.paraphrase?.semanticReview).toBe('required');
  });
});
