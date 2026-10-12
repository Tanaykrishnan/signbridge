import { z } from 'zod';

export const PARAPHRASE_LIMIT = 5000;
export const promptStrategySchema = z.enum(['zero-shot', 'few-shot', 'constrained']);
export type PromptStrategy = z.infer<typeof promptStrategySchema>;
export const paraphraseInputSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, 'Enter English text.')
      .max(PARAPHRASE_LIMIT)
      .regex(/[A-Za-z]/, 'Enter English text containing letters.'),
    strategy: promptStrategySchema.default('constrained'),
  })
  .strict();
export const generatedParaphraseSchema = z
  .object({
    paraphrase: z.string().trim().min(1).max(14000),
  })
  .strict();
export const PROMPT_STRATEGIES = [
  { id: 'zero-shot', label: 'Basic', description: 'Direct instruction' },
  { id: 'few-shot', label: 'With examples', description: 'Instruction and worked examples' },
  { id: 'constrained', label: 'Preserve meaning', description: 'Explicit rules and examples' },
] as const;
export interface FidelityCheck {
  label: string;
  status: 'pass' | 'warning' | 'not-applicable';
  detail: string;
}
export interface ParaphraseResult {
  id: string;
  createdAt: string;
  sourceText: string;
  paraphrase: string;
  strategy: PromptStrategy;
  prompt: { version: string; system: string; user: string };
  model: { id: string; provider: string; source: string; license: string };
  metrics: {
    latencyMs: number;
    inputWords: number;
    outputWords: number;
    wordChangePercent: number;
    promptTokens: number | null;
    completionTokens: number | null;
  };
  checks: FidelityCheck[];
  semanticReview: 'required';
  outputKind: 'english-paraphrase';
  persistence?: 'saved-local' | 'not-saved';
}
export interface ParaphraseStatus {
  state: 'ready' | 'offline' | 'misconfigured';
  model: string;
  provider: string;
  inputLimit: number;
  message: string;
}
