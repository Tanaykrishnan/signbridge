import { ISL_MOTION_BONES, islMotionSchema, type IslMotion } from '../../src/lib/isl-motion-schema';

// Synthetic rotations exercise the transport and renderer. They are NOT ISL signs.
export function testMotion(text: string): IslMotion {
  const rotations = Object.fromEntries(
    ISL_MOTION_BONES.map((bone) => [bone, [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]]),
  );
  rotations.RightArm = [0, 0, 0, 1, -Math.sin(0.7), 0, 0, Math.cos(0.7), 0, 0, 0, 1];
  return islMotionSchema.parse({
    version: 1,
    skeleton: 'signbridge-v1',
    targetLanguage: 'ISL',
    sourceText: text,
    model: {
      id: 'synthetic-test-fixture',
      version: 'test-only',
      source: 'https://example.org/test-only',
      license: 'Synthetic test fixture; not a model',
      licenseUrl: 'https://example.org/test-only/license',
      commercialUse: true,
      attribution:
        'Original test fixture. Not linguistic content and never installed in production.',
    },
    review: { status: 'unreviewed' },
    segments: [
      {
        start: 0,
        end: text.length,
        gloss: null,
        clip: {
          duration: 1,
          times: [0, 0.5, 1],
          rotations,
          expressions: { browLeft: [0, 1, 0], mouthOpen: [0, 0.7, 0] },
        },
      },
    ],
    limitations: ['NOT AN ISL TRANSLATION. Synthetic rotations solely test software.'],
  });
}
