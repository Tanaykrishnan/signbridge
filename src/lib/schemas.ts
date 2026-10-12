import { z } from 'zod';
export const reviewSchema = z.enum(['illustrative', 'unreviewed', 'reviewed']);
export const signSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  gloss: z.string().nullable().default(null),
  clip: z.string().min(1),
  asset: z
    .string()
    .regex(/^\/assets\//)
    .nullable()
    .default(null),
  duration: z.number().min(0.1).max(60),
  transition: z.number().min(0).max(1).default(0.18),
  review: reviewSchema,
  source: z.string(),
  license: z.string(),
  provenance: z.string(),
  available: z.boolean(),
  handshape: z.string().optional(),
  movement: z.string().optional(),
  facialExpression: z.string().optional(),
  fallback: z.enum(['skip', 'rest']).default('rest'),
  token: z
    .object({
      start: z.number().int().min(0),
      end: z.number().int().min(0),
      wordIndex: z.number().int().min(0),
      wordStart: z.number().int().min(0),
      wordEnd: z.number().int().min(0),
      kind: z.enum(['letter', 'pause', 'phrase']),
    })
    .optional(),
});
export const manifestSchema = z.object({
  version: z.literal(1),
  avatar: z.object({
    url: z
      .string()
      .regex(/^\/assets\//)
      .nullable(),
    name: z.string(),
    source: z.string(),
    license: z.string(),
    boneMap: z.record(z.string(), z.string()).default({}),
  }),
  signs: z.array(signSchema),
});
export const phraseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  text: z.string().min(1),
  aliases: z.array(z.string()),
  language: z.literal('en'),
  category: z.enum(['greetings', 'education', 'travel', 'emergencies', 'everyday']),
  description: z.string(),
  review: reviewSchema,
  source: z.string(),
  license: z.string(),
  reviewer: z.string().nullable(),
  signIds: z.array(z.string()),
});
export const translateSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, 'Enter text to translate.')
      .max(5000, 'Use 5,000 characters or fewer.'),
    language: z.literal('en').default('en'),
    outputMode: z.enum(['isl', 'asl-fingerspelling']).default('isl'),
    allowReferencePreview: z.boolean().default(false),
    fallback: z
      .literal('none', 'ISL requests cannot fall back to ASL. Select the ASL tool explicitly.')
      .default('none'),
    allowUnreviewedModel: z.boolean().default(false),
  })
  .strict();
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(200).default(''),
  category: z.string().max(40).optional(),
  review: reviewSchema.optional(),
  available: z.enum(['true', 'false']).optional(),
  status: z.enum(['supported', 'unsupported']).optional(),
});
export type Sign = z.infer<typeof signSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type Phrase = z.infer<typeof phraseSchema>;
export type Pagination = z.infer<typeof pageSchema>;
export type Translation = {
  status: 'supported' | 'unsupported';
  sourceText: string;
  normalized: string;
  language: string;
  phrase: Phrase | null;
  sequence: Sign[];
  playback: import('./phrase-playback').PhrasePlayback;
  match: 'exact' | 'alias' | null;
  provenance: string;
  linguisticConfidence: null;
  assetAvailability: 'available' | 'partial' | 'missing';
  message: string;
  outputMode?: 'isl' | 'asl-fingerspelling';
  targetLanguage?: 'ISL' | 'ASL';
  warnings?: string[];
  wordCount?: number;
  rendering?:
    'reviewed-isl' | 'isl-reference-preview' | 'isl-model-motion' | 'asl-fingerspelling' | 'none';
  requestedLanguage?: 'ISL' | 'ASL';
  generatedMotion?: import('./isl-motion-schema').IslMotion;
  blockReason?:
    | 'model-not-configured'
    | 'model-unavailable'
    | 'model-output-invalid'
    | 'model-review-required'
    | 'model-vocabulary-unavailable'
    | 'model-input-unsupported';
  unsupportedWords?: string[];
  historyReceipt?: string;
  originalSourceText?: string;
  paraphrase?: import('./paraphrase-schema').ParaphraseResult;
  phraseMatches?: { id: string; text: string; start: number; end: number }[];
  datasetMatch?: {
    text: string;
    gloss: string;
    source: string;
    license: string;
    licenseUrl: string;
    attribution: string;
    animationAvailable: false;
  };
};
export type HistoryItem = {
  id: string;
  userId: string;
  sourceText: string;
  phraseId: string | null;
  status: 'supported' | 'unsupported';
  createdAt: string;
  outputMode?: 'isl' | 'asl-fingerspelling';
};
export type Favorite = { id: string; userId: string; phraseId: string; createdAt: string };
