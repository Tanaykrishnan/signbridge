import * as THREE from 'three';
import { ISL_REFERENCE_SIGNS } from './isl-reference';
import type { LetterPose } from './asl-alphabet';

type HandFrame = {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  fingers: LetterPose['fingers'];
  thumb: LetterPose['thumb'];
};
const flat: LetterPose['fingers'] = [
  [0, 0, 0, -0.04],
  [0, 0, 0, 0],
  [0, 0, 0, 0.03],
  [0, 0, 0, 0.05],
];
const fist: LetterPose['fingers'] = Array.from({ length: 4 }, () => [
  1.25, 1.45, 0.8, 0,
]) as LetterPose['fingers'];
const relaxed: LetterPose['fingers'] = Array.from({ length: 4 }, () => [
  0.15, 0.2, 0.15, 0,
]) as LetterPose['fingers'];
const down = new THREE.Vector3(0, -1, 0);

function frame(
  dir: number,
  x: number,
  y: number,
  z: number,
  shape: 'flat' | 'fist' | 'thumb' | 'rest' = 'flat',
  wrist: [number, number, number] = [0, 0, 0],
): HandFrame {
  const rotation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0, 0, shape === 'rest' ? 0 : Math.PI),
  );
  rotation.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...wrist)));
  return {
    position: new THREE.Vector3(dir * x, y, z),
    rotation,
    fingers: shape === 'rest' ? relaxed : shape === 'flat' ? flat : fist,
    thumb:
      shape === 'thumb'
        ? [0.05, 0.05, 0.05, -0.05 * dir]
        : shape === 'fist'
          ? [0.75, 0.55, 0.4, 0.9 * dir]
          : [0.12, 0.1, 0.1, -0.6 * dir],
  };
}

// Analytic two-bone IK solves wrist placement on the original rig. This is
// geometric authoring, not a learned translation model or expert motion capture.
export function solveArm(shoulder: THREE.Vector3, target: THREE.Vector3, dir: number) {
  const upperLength = 0.31,
    lowerLength = 0.28;
  const direction = target.clone().sub(shoulder);
  if (direction.lengthSq() < 1e-10) direction.copy(down).multiplyScalar(0.04);
  const distance = THREE.MathUtils.clamp(
    direction.length(),
    0.04,
    upperLength + lowerLength - 0.001,
  );
  direction.normalize();
  const hint = new THREE.Vector3(dir, -0.65, 0.05);
  hint.addScaledVector(direction, -hint.dot(direction)).normalize();
  if (hint.lengthSq() < 0.1) hint.set(0, 0, 1);
  const cosine = THREE.MathUtils.clamp(
    (upperLength ** 2 + distance ** 2 - lowerLength ** 2) / (2 * upperLength * distance),
    -1,
    1,
  );
  const elbow = shoulder
    .clone()
    .addScaledVector(direction, upperLength * cosine)
    .addScaledVector(hint, upperLength * Math.sqrt(1 - cosine ** 2));
  const reachableTarget = shoulder.clone().addScaledVector(direction, distance);
  const upper = new THREE.Quaternion().setFromUnitVectors(
    down,
    elbow.clone().sub(shoulder).normalize(),
  );
  const lowerWorld = new THREE.Quaternion().setFromUnitVectors(
    down,
    reachableTarget.sub(elbow).normalize(),
  );
  return { upper, lower: upper.clone().invert().multiply(lowerWorld), lowerWorld };
}

export function createIslReferenceClips(root: THREE.Object3D): THREE.AnimationClip[] {
  return ISL_REFERENCE_SIGNS.map((sign) => {
    const id = sign.id.replace('isl-reference-', '');
    const times = [0, 0.15, 0.32, 0.5, 0.68, 0.84, 1].map((t) => t * sign.duration);
    const tracks: THREE.KeyframeTrack[] = [];
    for (const [side, dir] of [
      ['Right', 1],
      ['Left', -1],
    ] as const) {
      const rest = frame(dir, 0.29, 0.88, 0.03, 'rest');
      let poses = times.map(() => rest);
      const dominant = side === 'Right';
      if (id === 'namaste') {
        const approach = frame(dir, 0.12, 1.2, 0.24, 'flat', [0, (dir * Math.PI) / 2, 0]);
        const joined = frame(dir, 0.026, 1.2, 0.24, 'flat', [0, (dir * Math.PI) / 2, 0]);
        poses = [approach, joined, joined, joined, joined, rest, rest];
      } else if (id === 'how-are-you') {
        const start = frame(dir, 0.2, 1.27, 0.22, 'flat', [-Math.PI / 2, 0, 0]);
        const lower = frame(dir, 0.2, 1.16, 0.22, 'flat', [-Math.PI / 2, 0, 0]);
        const thumbs = frame(dir, 0.13, 1.28, 0.22, 'thumb');
        poses = [start, start, lower, thumbs, thumbs, rest, rest];
      } else if (dominant && id === 'hello') {
        const start = frame(dir, 0.16, 1.57, 0.19, 'flat', [0.12, 0, 0.25]);
        const outward = frame(dir, 0.34, 1.57, 0.3, 'flat', [0, -0.25, 0]);
        poses = [start, start, outward, outward, outward, rest, rest];
      } else if (dominant && id === 'thank-you') {
        const start = frame(dir, 0.025, 1.37, 0.2, 'flat', [0.35, 0, 0]);
        const outward = frame(dir, 0.025, 1.4, 0.43, 'flat', [-0.8, 0, 0]);
        poses = [start, start, outward, outward, outward, rest, rest];
      } else if (dominant && id === 'sorry') {
        poses = [
          [0.06, 1.26],
          [0.085, 1.28],
          [0.06, 1.305],
          [0.035, 1.28],
          [0.06, 1.26],
        ].map(([x, y]) => frame(dir, x, y, 0.18, 'fist'));
        poses.push(rest, rest);
      } else if (dominant && id === 'bye') {
        poses = [0.31, 0.39, 0.26, 0.39, 0.31].map((x) => frame(dir, x, 1.5, 0.22));
        poses.push(rest, rest);
      } else if (dominant && id === 'good-morning') {
        const thumb = frame(dir, 0.03, 1.24, 0.2, 'thumb');
        const face = frame(dir, 0.21, 1.54, 0.2);
        const rising = frame(dir, 0.3, 1.65, 0.25);
        poses = [thumb, thumb, face, rising, rising, rest, rest];
      }
      const shoulder = new THREE.Vector3(dir * 0.29, 1.4, 0);
      const rotations = new Map<string, THREE.Quaternion[]>();
      const push = (name: string, rotation: THREE.Quaternion) =>
        rotations.set(name, [...(rotations.get(name) ?? []), rotation]);
      for (const pose of poses) {
        const solved = solveArm(shoulder, pose.position, dir);
        push(`${side}Arm`, solved.upper);
        push(`${side}ForeArm`, solved.lower);
        push(`${side}Hand`, solved.lowerWorld.clone().invert().multiply(pose.rotation));
        for (let finger = 0; finger < 4; finger++) {
          const [a, b, c, spread] = pose.fingers[finger];
          const name = `${side}Finger${3 - finger}`;
          push(name, new THREE.Quaternion().setFromEuler(new THREE.Euler(-a, 0, -spread * dir)));
          push(`${name}Tip`, new THREE.Quaternion().setFromEuler(new THREE.Euler(-b, 0, 0)));
          push(`${name}End`, new THREE.Quaternion().setFromEuler(new THREE.Euler(-c, 0, 0)));
        }
        const [a, b, c, spread] = pose.thumb;
        push(
          `${side}Finger4`,
          new THREE.Quaternion().setFromEuler(new THREE.Euler(-a, -0.15 * dir, -spread)),
        );
        push(`${side}Finger4Tip`, new THREE.Quaternion().setFromEuler(new THREE.Euler(-b, 0, 0)));
        push(`${side}Finger4End`, new THREE.Quaternion().setFromEuler(new THREE.Euler(-c, 0, 0)));
      }
      for (const [name, quaternions] of rotations)
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${name}.quaternion`,
            times,
            quaternions.flatMap((q) => q.toArray()),
          ),
        );
      const handPosition = root.getObjectByName(`${side}Hand`)!.position.toArray();
      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${side}Hand.position`,
          times,
          times.flatMap(() => handPosition),
        ),
      );
    }
    for (const name of ['Head', 'Spine'])
      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${name}.quaternion`,
          times,
          times.flatMap(() => [0, 0, 0, 1]),
        ),
      );
    return new THREE.AnimationClip(sign.clip, sign.duration, tracks);
  });
}
