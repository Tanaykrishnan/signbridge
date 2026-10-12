import { z } from 'zod';

export const ISL_MOTION_BONES = [
  'Spine',
  'Neck',
  'Head',
  ...(['Left', 'Right'] as const).flatMap((side) => [
    `${side}Arm`,
    `${side}ForeArm`,
    `${side}Hand`,
    ...Array.from({ length: 5 }, (_, i) => [
      `${side}Finger${i}`,
      `${side}Finger${i}Tip`,
      `${side}Finger${i}End`,
    ]).flat(),
  ]),
] as const;

const citationUrl = z
  .url()
  .refine((v) => new URL(v).protocol === 'https:', 'Use an HTTPS citation.');
const samples = z.array(z.number().finite()).min(2).max(1801);
const clipSchema = z
  .object({
    duration: z.number().min(0.1).max(60),
    times: samples,
    rotations: z.record(
      z.enum(ISL_MOTION_BONES),
      z.array(z.number().finite().min(-1.01).max(1.01)).min(8).max(7204),
    ),
    expressions: z
      .object({
        browLeft: samples.optional(),
        browRight: samples.optional(),
        mouthOpen: samples.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((clip, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (clip.times[0] !== 0 || Math.abs(clip.times.at(-1)! - clip.duration) > 1e-5)
      fail('Motion timestamps must span zero through the clip duration.');
    if (clip.times.some((t, i) => t < 0 || (i > 0 && t <= clip.times[i - 1])))
      fail('Motion timestamps must increase strictly.');
    for (const values of Object.values(clip.rotations)) {
      if (values.length !== clip.times.length * 4) {
        fail('Every joint needs one quaternion per timestamp.');
        continue;
      }
      for (let i = 0; i < values.length; i += 4) {
        const norm = Math.hypot(...values.slice(i, i + 4));
        if (Math.abs(norm - 1) > 0.01) {
          fail('Joint rotations must be unit quaternions.');
          break;
        }
      }
    }
    for (const values of Object.values(clip.expressions ?? {}))
      if (values.length !== clip.times.length || values.some((v) => v < 0 || v > 1))
        fail('Facial expression weights must be in [0,1], one per timestamp.');
  });

export const lexicalMappingSchema = z
  .object({
    source: z.string().min(1).max(120),
    target: z.string().min(1).max(120),
    rule: z.literal('spatial-directions-v1'),
    review: z.literal('unreviewed'),
  })
  .strict();
const motionShape = z
  .object({
    version: z.literal(1),
    skeleton: z.literal('signbridge-v1'),
    targetLanguage: z.literal('ISL'),
    sourceText: z.string().min(1).max(5000),
    model: z
      .object({
        id: z.string().min(1).max(120),
        version: z.string().min(1).max(120),
        source: citationUrl,
        license: z.string().min(1).max(200),
        licenseUrl: citationUrl,
        commercialUse: z.boolean(),
        attribution: z.string().min(1).max(2000),
      })
      .strict(),
    review: z
      .object({
        status: z.enum(['unreviewed', 'reviewed']),
        reviewer: z.string().min(1).max(300).optional(),
        evidenceUrl: citationUrl.optional(),
      })
      .strict()
      .superRefine((review, ctx) => {
        if (review.status === 'reviewed' && (!review.reviewer || !review.evidenceUrl))
          ctx.addIssue({
            code: 'custom',
            message: 'Reviewed output requires reviewer and evidence.',
          });
      }),
    segments: z
      .array(
        z
          .object({
            start: z.number().int().min(0).max(5000),
            end: z.number().int().min(1).max(5000),
            gloss: z.string().min(1).max(500).nullable(),
            clip: clipSchema,
          })
          .strict(),
      )
      .min(1)
      .max(128),
    limitations: z.array(z.string().min(1).max(500)).max(30),
    lexicalMappings: z.array(lexicalMappingSchema).max(160).optional(),
  })
  .strict()
  .superRefine((motion, ctx) => {
    let end = 0;
    let duration = 0;
    for (const segment of motion.segments) {
      if (
        segment.start < end ||
        segment.end <= segment.start ||
        segment.end > motion.sourceText.length ||
        motion.sourceText.slice(end, segment.start).trim() ||
        !motion.sourceText.slice(segment.start, segment.end).trim()
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Motion must cover the complete source without overlaps or omitted text.',
        });
      end = segment.end;
      duration += segment.clip.duration;
    }
    if (motion.sourceText.slice(end).trim())
      ctx.addIssue({ code: 'custom', message: 'Motion omitted the end of the input.' });
    if (duration > 600)
      ctx.addIssue({
        code: 'custom',
        message: 'Split motion longer than ten minutes into sections.',
      });
  });

// The remote-provider contract remains commercial-only. Local research assets pass
// a separate gate and must never acquire a misleading commercial license flag.
export const islMotionSchema = motionShape.refine(
  (m) => m.model.commercialUse === true,
  'Remote motion requires established commercial-use permission.',
);
export const researchMotionSchema = motionShape.refine(
  (m) =>
    m.model.id === 'local-sign-vqvae' &&
    m.model.commercialUse === false &&
    m.review.status === 'unreviewed',
  'Local research motion must retain its restricted scope and unreviewed status.',
);
export type IslMotion = z.infer<typeof motionShape>;
export type IslModelState = 'not-configured' | 'configured' | 'misconfigured';
export type IslCapabilities = {
  targetLanguage: 'ISL';
  model: {
    state: IslModelState;
    message: string;
    engine?: 'local-sign-vqvae';
    vocabularySize?: number;
  };
  referencePreviewCount: number;
  arbitraryTextGuaranteed: false;
  maxTextLength: number;
};
export class IslModelError extends Error {
  constructor(
    public code:
      | 'model-unavailable'
      | 'model-output-invalid'
      | 'model-vocabulary-unavailable'
      | 'model-input-unsupported',
    message: string,
    public unsupportedWords: string[] = [],
  ) {
    super(message);
  }
}
export interface IslMotionProvider {
  readonly scope?: 'local-research';
  generate(text: string, language: string, signal?: AbortSignal): Promise<unknown | null>;
}
