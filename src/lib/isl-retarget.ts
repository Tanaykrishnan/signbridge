import { Matrix4, Quaternion, Vector3 } from 'three';
import { z } from 'zod';
import { ISL_MOTION_BONES, lexicalMappingSchema, type IslMotion } from './isl-motion-schema';

const point = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
export const researchPoseSchema = z
  .object({
    sourceText: z.string().min(1).max(5000),
    version: z.literal('SignVQVAE_241108_1706'),
    vocabularySize: z.number().int().positive(),
    segments: z
      .array(
        z
          .object({
            start: z.number().int().nonnegative(),
            end: z.number().int().positive(),
            labels: z.array(z.string().min(1).max(120)).min(1).max(24),
            ids: z.array(z.string().regex(/^\d+$/)).min(1).max(24),
            omittedFunctionWords: z.array(z.string()).max(200),
            lexicalMappings: z.array(lexicalMappingSchema).max(24).default([]),
            complexClause: z.boolean(),
            times: z.array(z.number().finite().nonnegative()).min(2).max(1801),
            poses: z.array(z.array(point).length(51)).min(2).max(1801),
          })
          .strict()
          .refine((s) => s.poses.length === s.times.length && s.ids.length === s.labels.length),
      )
      .min(1)
      .max(64),
  })
  .strict();

const DOWN = new Vector3(0, -1, 0);
function unit(vector: Vector3) {
  if (vector.lengthSq() < 1e-12) throw new Error('Degenerate model bone direction');
  return vector.normalize();
}
function direction(a: Vector3, b: Vector3) {
  return new Quaternion().setFromUnitVectors(DOWN, unit(b.clone().sub(a)));
}

/** MediaPipe camera coordinates -> local rotations of the original SignBridge rig.
 * Legacy Left nodes are on negative X, so they receive the anatomical right side.
 * No facial grammar is synthesized from the handful of available face landmarks.
 */
export function retargetPoseClip(
  poses: number[][][],
  times: number[],
): IslMotion['segments'][number]['clip'] {
  const rotations = Object.fromEntries(ISL_MOTION_BONES.map((bone) => [bone, [] as number[]]));
  for (const frame of poses) {
    const p = frame.map(([x, y, z]) => new Vector3(x, -y, -z));
    const qs: Record<string, Quaternion> = {
      Spine: new Quaternion(),
      Neck: new Quaternion(),
      Head: new Quaternion(),
    };
    for (const [side, shoulder, elbow, wrist, mirror] of [
      ['Left', 4, 6, 30, -1],
      ['Right', 3, 5, 9, 1],
    ] as const) {
      const arm = direction(p[shoulder], p[elbow]);
      const fore = direction(p[elbow], p[wrist]);
      const y = unit(p[wrist].clone().sub(p[wrist + 9]));
      const x = p[wrist + 5]
        .clone()
        .sub(p[wrist + 17])
        .multiplyScalar(mirror);
      x.addScaledVector(y, -x.dot(y));
      unit(x);
      const z = unit(new Vector3().crossVectors(x, y));
      const palm = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
      qs[`${side}Arm`] = arm;
      qs[`${side}ForeArm`] = arm.clone().invert().multiply(fore);
      qs[`${side}Hand`] = fore.clone().invert().multiply(palm);
      for (const [digit, base] of [17, 13, 9, 5, 1].entries()) {
        let parent = palm;
        for (const [joint, suffix] of ['', 'Tip', 'End'].entries()) {
          const world = direction(p[wrist + base + joint], p[wrist + base + joint + 1]);
          qs[`${side}Finger${digit}${suffix}`] = parent.clone().invert().multiply(world);
          parent = world;
        }
      }
    }
    for (const bone of ISL_MOTION_BONES) {
      const values = rotations[bone];
      const q = qs[bone].normalize().toArray();
      // Keep quaternion signs continuous for interpolation and serialized inspection.
      const flip =
        values.length && q.reduce((sum, v, i) => sum + v * values[values.length - 4 + i], 0) < 0;
      values.push(...q.map((v) => Number((flip ? -v : v).toFixed(6))));
    }
  }
  return { duration: times.at(-1)!, times, rotations };
}

export function retargetResearchOutput(input: unknown): IslMotion {
  const raw = researchPoseSchema.parse(input);
  const lexicalMappings = raw.segments.flatMap((segment) => segment.lexicalMappings);
  const source = 'https://github.com/suvajit-patra/sl-vqvae-gen-demo';
  return {
    version: 1,
    skeleton: 'signbridge-v1',
    targetLanguage: 'ISL',
    sourceText: raw.sourceText,
    model: {
      id: 'local-sign-vqvae',
      version: raw.version,
      source,
      license: 'Research evaluation only; asset commercial rights not established',
      licenseUrl: `${source}#license`,
      commercialUse: false,
      attribution:
        'SignVQVAE by Suvajit Patra and collaborators, public FDMSE-ISL encoded release. Local Stanza dependency planner and SignBridge retargeting are experimental and unreviewed.',
    },
    review: { status: 'unreviewed' },
    lexicalMappings,
    segments: raw.segments.map((segment) => ({
      start: segment.start,
      end: segment.end,
      gloss: segment.labels.join(' / '),
      clip: retargetPoseClip(segment.poses, segment.times),
    })),
    limitations: [
      'Experimental ISL lexical motion sequence, not a validated sentence translation. Word senses, grammar and coarticulation require Deaf ISL expert review.',
      ...(lexicalMappings.length
        ? [
            `Unreviewed contextual English mapping to existing motion: ${[...new Set(lexicalMappings.map((m) => `${m.source} -> ${m.target} (${m.rule})`))].join(', ').slice(0, 350)}.`,
          ]
        : []),
      'No fingerspelling or ASL substitution. Unknown vocabulary blocks the entire request.',
      'Retargeted body proportions can change hand contact. Facial grammar and spatial reference are not reconstructed.',
      'Playback uses an explicit 30 source-fps timing assumption; original recording timing is not included in this release.',
      'Local research evaluation only. The repository declares MIT for code, but separate model/data commercial permissions have not been established.',
      ...(raw.segments.some((s) => s.complexClause)
        ? ['Complex clauses retain lexical order; their ISL syntax has not been resolved.']
        : []),
      ...([...new Set(raw.segments.flatMap((s) => s.omittedFunctionWords))].length
        ? [
            `English grammatical support words omitted by the experimental planner: ${[...new Set(raw.segments.flatMap((s) => s.omittedFunctionWords))].join(', ').slice(0, 350)}.`,
          ]
        : []),
    ],
  };
}
