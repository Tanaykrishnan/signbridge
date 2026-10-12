import * as THREE from 'three';
import type { IslMotion } from './isl-motion-schema';

export function motionClipId(index: number) {
  return `isl-generated-${index}`;
}

// The model adapter must retarget to this rig's local rest pose before responding.
export function createGeneratedIslClips(motion: IslMotion): THREE.AnimationClip[] {
  return motion.segments.map((segment, index) => {
    const { duration, times, rotations, expressions } = segment.clip;
    const tracks: THREE.KeyframeTrack[] = Object.entries(rotations).map(
      ([bone, values]) => new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values),
    );
    for (const key of ['browLeft', 'browRight', 'mouthOpen'] as const) {
      const values = expressions?.[key] ?? times.map(() => 0);
      const track =
        key === 'mouthOpen'
          ? 'FaceMouth.scale[y]'
          : `FaceBrow${key === 'browLeft' ? 'Left' : 'Right'}.position[y]`;
      tracks.push(
        new THREE.NumberKeyframeTrack(
          track,
          times,
          values.map((v) => (key === 'mouthOpen' ? 0.35 + v * 2.5 : 0.065 + v * 0.035)),
        ),
      );
    }
    return new THREE.AnimationClip(motionClipId(index), duration, tracks);
  });
}
