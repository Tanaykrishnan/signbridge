import * as THREE from 'three';
import { createFingerspellingClips } from './fingerspelling-clips';
import { createIslReferenceClips } from './isl-clips';
export function createDemoRig(presentation?: 'studio') {
  const studio = presentation === 'studio';
  const root = new THREE.Group();
  root.name = 'SignBridgeRig';
  const shell = new THREE.MeshStandardMaterial({
    color: studio ? '#e4e5dc' : '#d0d7e2',
    roughness: studio ? 0.29 : 0.43,
    metalness: studio ? 0.55 : 0.26,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: studio ? '#252823' : '#303342',
    roughness: 0.5,
    metalness: 0.35,
  });
  const cyan = new THREE.MeshStandardMaterial({
    color: studio ? '#dfff00' : '#ff8b75',
    roughness: 0.3,
    metalness: 0.35,
  });
  function sphere(
    parent: THREE.Object3D,
    r: number,
    x: number,
    y: number,
    z: number,
    mat = shell,
    sx = 1,
    sy = 1,
    sz = 1,
  ) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 20), mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function limb(parent: THREE.Object3D, length: number, r: number, mat = shell) {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, length - 2 * r, 5, 12), mat);
    m.position.y = -length / 2;
    m.castShadow = true;
    parent.add(m);
  }
  function bone(parent: THREE.Object3D, name: string, x: number, y: number, z = 0) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    parent.add(b);
    return b;
  }
  const hips = bone(root, 'Hips', 0, 0.92);
  sphere(hips, 0.18, 0, 0, 0, dark, 1.1, 0.7, 0.72);
  const spine = bone(hips, 'Spine', 0, 0.1);
  sphere(spine, 0.27, 0, 0.2, 0, shell, 1, 0.95, 0.54);
  sphere(spine, 0.22, 0, 0.38, 0, dark, 1.13, 0.38, 0.67);
  sphere(spine, 0.03, 0, 0.36, 0.153, cyan, 1, 1, 0.35);
  const neck = bone(spine, 'Neck', 0, 0.49);
  sphere(neck, 0.066, 0, 0, 0, dark);
  const head = bone(neck, 'Head', 0, 0.16);
  sphere(head, 0.145, 0, 0, 0, shell, 1, 1.16, 0.9);
  sphere(head, 0.027, -0.052, 0.025, 0.127, dark, 1, 0.7, 0.28);
  sphere(head, 0.027, 0.052, 0.025, 0.127, dark, 1, 0.7, 0.28);
  sphere(head, 0.011, -0.052, 0.025, 0.133, cyan, 1, 0.7, 0.25);
  sphere(head, 0.011, 0.052, 0.025, 0.133, cyan, 1, 0.7, 0.25);
  sphere(head, 0.024, -0.052, 0.065, 0.129, dark, 1.2, 0.22, 0.25).name = 'FaceBrowLeft';
  sphere(head, 0.024, 0.052, 0.065, 0.129, dark, 1.2, 0.22, 0.25).name = 'FaceBrowRight';
  sphere(head, 0.032, 0, -0.057, 0.125, dark, 1, 0.35, 0.2).name = 'FaceMouth';
  for (const [side, dir] of [
    ['Left', -1],
    ['Right', 1],
  ] as const) {
    const arm = bone(spine, side + 'Arm', dir * 0.29, 0.38);
    sphere(arm, 0.077, 0, 0, 0, dark);
    limb(arm, 0.31, 0.061);
    const fore = bone(arm, side + 'ForeArm', 0, -0.31);
    sphere(fore, 0.05, 0, 0, 0, cyan);
    limb(fore, 0.28, 0.048);
    const hand = bone(fore, side + 'Hand', 0, -0.28);
    sphere(hand, 0.056, 0, -0.04, 0, shell, 0.8, 1.13, 0.48);
    for (let i = 0; i < 5; i++) {
      const thumb = i === 4;
      const digit = bone(
        hand,
        side + 'Finger' + i,
        thumb ? dir * 0.046 : (i - 1.5) * 0.023,
        thumb ? -0.018 : -0.082,
        0.008,
      );
      if (thumb) digit.rotation.z = dir * 0.62;
      const proximal = thumb ? 0.043 : [0.036, 0.045, 0.05, 0.044][i];
      const middle = thumb ? 0.025 : [0.024, 0.03, 0.032, 0.029][i];
      limb(digit, proximal, 0.009);
      const tip = bone(digit, side + 'Finger' + i + 'Tip', 0, -proximal);
      limb(tip, middle, 0.007);
      const end = bone(tip, side + 'Finger' + i + 'End', 0, -middle);
      limb(end, thumb ? 0.018 : 0.021, 0.006);
    }
    const thigh = bone(hips, side + 'UpLeg', dir * 0.12, -0.05);
    limb(thigh, 0.39, 0.073, dark);
    const leg = bone(thigh, side + 'Leg', 0, -0.39);
    sphere(leg, 0.053, 0, 0, 0, cyan);
    limb(leg, 0.35, 0.056, shell);
    sphere(leg, 0.085, 0, -0.35, 0.05, dark, 0.83, 0.6, 1.55);
  }
  const idleNames = [
    'RightArm',
    'RightForeArm',
    'RightHand',
    'LeftArm',
    'LeftForeArm',
    'LeftHand',
    'Head',
    'Spine',
  ];
  function clip(name: string, duration: number, poses: Record<string, number[][]>) {
    const tracks = idleNames.map((n) => {
      const rotations = poses[n] ?? [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];
      const values = rotations.flatMap((a) =>
        new THREE.Quaternion().setFromEuler(new THREE.Euler(a[0], a[1], a[2])).toArray(),
      );
      return new THREE.QuaternionKeyframeTrack(
        n + '.quaternion',
        [0, duration * 0.3, duration * 0.72, duration],
        values,
      );
    });
    return new THREE.AnimationClip(name, duration, tracks);
  }
  const clips = [
    clip('demo-open', 2.4, {
      RightArm: [
        [0, 0, -0.05],
        [-0.6, 0, -0.75],
        [-0.6, 0, -0.75],
        [0, 0, -0.05],
      ],
      RightForeArm: [
        [0, 0, 0],
        [-1.7, 0, 0],
        [-1.7, 0, 0],
        [0, 0, 0],
      ],
      RightHand: [
        [0, 0, 0],
        [0, -0.3, -0.2],
        [0, 0.3, 0.2],
        [0, 0, 0],
      ],
      Head: [
        [0, 0, 0],
        [0, 0.1, -0.03],
        [0, 0.1, -0.03],
        [0, 0, 0],
      ],
    }),
    clip('demo-reach', 2.2, {
      RightArm: [
        [0, 0, 0],
        [-0.8, 0, -0.25],
        [-0.8, 0, -0.25],
        [0, 0, 0],
      ],
      LeftArm: [
        [0, 0, 0],
        [-0.8, 0, 0.25],
        [-0.8, 0, 0.25],
        [0, 0, 0],
      ],
      RightForeArm: [
        [0, 0, 0],
        [-0.7, 0, 0],
        [-0.4, 0, 0],
        [0, 0, 0],
      ],
      LeftForeArm: [
        [0, 0, 0],
        [-0.7, 0, 0],
        [-0.4, 0, 0],
        [0, 0, 0],
      ],
    }),
    clip('demo-rest', 1.4, {}),
  ];
  return {
    root,
    clips: [...clips, ...createFingerspellingClips(root), ...createIslReferenceClips(root)],
  };
}
export function disposeRig(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      geometries.add(obj.geometry);
      for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) materials.add(m);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose();
    m.dispose();
  });
}
export function remapClip(clip: THREE.AnimationClip, boneMap: Record<string, string>) {
  const copy = clip.clone();
  copy.tracks.forEach((t) => {
    const dot = t.name.lastIndexOf('.');
    const node = t.name.slice(0, dot);
    if (boneMap[node]) t.name = boneMap[node] + t.name.slice(dot);
  });
  return copy;
}
