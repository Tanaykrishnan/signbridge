import * as THREE from 'three';
import { ASL_POSES, ASL_SIGNS, ASL_REPEAT_SIGNS, ASL_PAUSE, type LetterPose } from './asl-alphabet';

export function createFingerspellingClips(root: THREE.Object3D): THREE.AnimationClip[] {
  const arm = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, 0, 0));
  const forearm = new THREE.Quaternion().setFromEuler(new THREE.Euler(-2.25, 0, 0));
  const parent = arm.clone().multiply(forearm);
  const restHand = root.getObjectByName('RightHand')!.position.clone();
  const relaxed: LetterPose = {
    fingers: [
      [0.15, 0.2, 0.15, 0],
      [0.15, 0.2, 0.15, 0],
      [0.15, 0.2, 0.15, 0],
      [0.15, 0.2, 0.15, 0],
    ],
    thumb: [0.1, 0.1, 0.1, -0.55],
    wrist: [0, 0, 0],
    description: 'Word pause',
  };
  return [...ASL_SIGNS, ...ASL_REPEAT_SIGNS, ASL_PAUSE].map((sign) => {
    const pose = ASL_POSES[sign.label] ?? relaxed;
    const times = [
      0,
      sign.duration * 0.2,
      sign.duration * 0.48,
      sign.duration * 0.73,
      sign.duration,
    ];
    const tracks: THREE.KeyframeTrack[] = [];
    const rotation = (name: string, quaternion: THREE.Quaternion) => {
      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${name}.quaternion`,
          times,
          times.flatMap(() => quaternion.toArray()),
        ),
      );
    };
    rotation('RightArm', arm);
    rotation('RightForeArm', forearm);
    const worldHand = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI));
    worldHand.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose.wrist)));
    rotation('RightHand', parent.clone().invert().multiply(worldHand));
    for (let finger = 0; finger < 4; finger++) {
      const [proximal, middle, distal, spread] = pose.fingers[finger];
      // The legacy rig numbers fingers from little finger (0) to index (3).
      const name = `RightFinger${3 - finger}`;
      rotation(name, new THREE.Quaternion().setFromEuler(new THREE.Euler(-proximal, 0, -spread)));
      rotation(`${name}Tip`, new THREE.Quaternion().setFromEuler(new THREE.Euler(-middle, 0, 0)));
      rotation(`${name}End`, new THREE.Quaternion().setFromEuler(new THREE.Euler(-distal, 0, 0)));
    }
    const [proximal, middle, distal, spread] = pose.thumb;
    rotation(
      'RightFinger4',
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-proximal, -0.15, -spread)),
    );
    rotation(
      'RightFinger4Tip',
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-middle, 0, 0)),
    );
    rotation(
      'RightFinger4End',
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-distal, 0, 0)),
    );
    const path =
      pose.path === 'j'
        ? [
            [0, 0],
            [0, 0],
            [0.01, -0.055],
            [-0.025, -0.075],
            [-0.055, -0.04],
          ]
        : pose.path === 'z'
          ? [
              [0.04, 0.035],
              [0.04, 0.035],
              [-0.04, 0.035],
              [0.04, -0.035],
              [-0.04, -0.035],
            ]
          : sign.clip.endsWith('-repeat')
            ? [
                [0, 0],
                [0, 0],
                [-0.025, 0],
                [-0.025, 0],
                [0, 0],
              ]
            : times.map(() => [0, 0]);
    const inverse = parent.clone().invert();
    const positions = path.flatMap(([x, y]) =>
      restHand
        .clone()
        .add(new THREE.Vector3(x, y, 0).applyQuaternion(inverse))
        .toArray(),
    );
    tracks.push(new THREE.VectorKeyframeTrack('RightHand.position', times, positions));
    return new THREE.AnimationClip(sign.clip, sign.duration, tracks);
  });
}
