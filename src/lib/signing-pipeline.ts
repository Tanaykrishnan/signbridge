import { generateParaphrase, ParaphraseError } from './paraphrase';
import { paraphraseInputSchema } from './paraphrase-schema';
import { translateSchema, type Translation } from './schemas';
import type { z } from 'zod';

export type SigningInput = z.infer<typeof translateSchema>;
type Signer = (text: string, input: SigningInput, signal?: AbortSignal) => Promise<Translation>;

// sourceText remains the text driving animation token offsets. Preserve the original separately.
export async function runSigningPipeline(
  rawInput: SigningInput,
  sign: Signer,
  signal?: AbortSignal,
  paraphrase = generateParaphrase,
): Promise<Translation> {
  const input = translateSchema.parse(rawInput);
  paraphraseInputSchema.parse({ text: input.text });
  signal?.throwIfAborted();
  const generated = await paraphrase(input.text, 'constrained', signal);
  signal?.throwIfAborted();
  const signingText = generated.paraphrase.trim();
  if (!signingText || signingText.length > 5000 || !/[A-Za-z]/.test(signingText))
    throw new ParaphraseError(
      422,
      'The generated English text cannot be signed: it must contain letters and fit within 5,000 characters. No text was truncated or converted.',
    );
  const result = await sign(signingText, input, signal);
  signal?.throwIfAborted();
  return {
    ...result,
    originalSourceText: input.text,
    paraphrase: generated,
    warnings: [
      'Signing uses the generated English paraphrase, not the original text. Check that its meaning is preserved; automatic checks are heuristics, not semantic validation.',
      ...generated.checks
        .filter((c) => c.status === 'warning')
        .map((c) => `${c.label}: ${c.detail}`),
      ...(result.warnings ?? []),
    ],
  };
}
