import { describe, expect, it } from 'vitest';
import {
  retargetPoseClip,
  retargetResearchOutput,
  researchPoseSchema,
} from '../src/lib/isl-retarget';
import {
  ISL_MOTION_BONES,
  researchMotionSchema,
  islMotionSchema,
} from '../src/lib/isl-motion-schema';
import { LocalIslProvider } from '../src/lib/isl-translation';
import { catalog, assets } from '../src/lib/catalog';
import { testMotion } from './fixtures/isl-motion';

// Non-linguistic geometry fixture used only to exercise retargeting invariants.
function pose() {
  const p = Array.from({ length: 51 }, () => [0, 0, 0]);
  for (const [shoulder, elbow, wrist, sign] of [
    [3, 5, 9, 1],
    [4, 6, 30, -1],
  ]) {
    p[shoulder] = [sign * 0.3, 0, 0];
    p[elbow] = [sign * 0.35, 0.3, 0.01];
    p[wrist] = [sign * 0.4, 0.5, -0.2];
    for (let digit = 0; digit < 5; digit++) {
      for (let j = 0; j < 4; j++)
        p[wrist + 1 + digit * 4 + j] = [sign * 0.4 + (2 - digit) * 0.02, 0.55 + j * 0.03, -0.2];
    }
  }
  return p;
}

describe('Research retargeting and trust boundary', () => {
  it('preserves explicitly unreviewed contextual mapping evidence through retargeting', () => {
    const mapping = {
      source: 'way',
      target: 'Direction',
      rule: 'spatial-directions-v1',
      review: 'unreviewed',
    };
    const raw = {
      sourceText: 'Show me the way to the library.',
      version: 'SignVQVAE_241108_1706',
      vocabularySize: 1997,
      segments: [
        {
          start: 0,
          end: 31,
          labels: ['Direction'],
          ids: ['1'],
          omittedFunctionWords: [],
          complexClause: false,
          lexicalMappings: [mapping],
          times: [0, 1],
          poses: [pose(), pose()],
        },
      ],
    };
    raw.segments[0].end = raw.sourceText.length;
    const result = retargetResearchOutput(raw);
    expect(result.lexicalMappings).toEqual([mapping]);
    expect(result.limitations.join(' ')).toContain('way -> Direction');
    expect(researchMotionSchema.safeParse(result).success).toBe(true);
    expect(islMotionSchema.safeParse(result).success).toBe(false);
    expect(
      researchPoseSchema.safeParse({
        ...raw,
        segments: [{ ...raw.segments[0], lexicalMappings: [{ ...mapping, review: 'reviewed' }] }],
      }).success,
    ).toBe(false);
  });
  it('produces every joint with finite normalized quaternions and consistent signs', () => {
    const a = pose();
    const b = pose();
    b[6][2] -= 0.1;
    const clip = retargetPoseClip([a, b], [0, 1]);
    expect(Object.keys(clip.rotations)).toHaveLength(ISL_MOTION_BONES.length);
    for (const values of Object.values(clip.rotations)) {
      expect(values).toHaveLength(8);
      expect(Math.hypot(...values.slice(0, 4))).toBeCloseTo(1, 5);
      expect(Math.hypot(...values.slice(4))).toBeCloseTo(1, 5);
    }
    expect(clip.rotations.LeftForeArm.slice(0, 4)).not.toEqual(clip.rotations.LeftForeArm.slice(4));
  });
  it('rejects degenerate bone vectors and malformed pose structures', () => {
    expect(() => retargetPoseClip([Array.from({ length: 51 }, () => [0, 0, 0])], [0])).toThrow();
    expect(researchPoseSchema.safeParse({ sourceText: 'Hello', segments: [] }).success).toBe(false);
  });
  it('does not loosen the remote commercial licensing contract', async () => {
    const motion = testMotion('What is your name?');
    motion.model.id = 'local-sign-vqvae';
    motion.model.commercialUse = false;
    expect(islMotionSchema.safeParse(motion).success).toBe(false);
    expect(researchMotionSchema.safeParse(motion).success).toBe(true);
    const unknown = { ...motion, model: { ...motion.model, id: 'untrusted-provider' } };
    expect(researchMotionSchema.safeParse(unknown).success).toBe(false);
    const remote = await new LocalIslProvider(undefined, {
      generate: async () => motion,
    }).translate(motion.sourceText, 'en', catalog, assets.signs, { allowUnreviewedModel: true });
    expect(remote.blockReason).toBe('model-output-invalid');
    const local = await new LocalIslProvider(undefined, {
      scope: 'local-research',
      generate: async () => motion,
    }).translate(motion.sourceText, 'en', catalog, assets.signs, { allowUnreviewedModel: true });
    expect(local.playback).toBe('ready');
  });
  it('preserves reviewed-only behavior without running an unreviewed research model', async () => {
    let called = false;
    const local = new LocalIslProvider(undefined, {
      scope: 'local-research',
      generate: async () => {
        called = true;
        return testMotion('Hello');
      },
    });
    const result = await local.translate('Hello', 'en', catalog, assets.signs);
    expect(called).toBe(false);
    expect(result.phrase?.text).toBe('Hello');
    expect(result.playback).not.toBe('ready');
  });
});
