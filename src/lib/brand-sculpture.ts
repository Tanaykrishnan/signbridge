import * as THREE from 'three';

// Original mechanical-hand artwork. Its poses are not language or signing data.
export function createBrandSculpture() {
  const silver = new THREE.MeshPhysicalMaterial({
    color: '#d8dee5',
    metalness: 0.88,
    roughness: 0.2,
    clearcoat: 0.4,
  });
  const graphite = new THREE.MeshStandardMaterial({
    color: '#27282e',
    metalness: 0.75,
    roughness: 0.31,
  });
  const joint = new THREE.MeshStandardMaterial({
    color: '#121318',
    roughness: 0.45,
    metalness: 0.6,
  });
  const mint = new THREE.MeshStandardMaterial({
    color: '#ff806b',
    emissive: '#fa674e',
    emissiveIntensity: 0.3,
    metalness: 0.4,
    roughness: 0.28,
  });
  const root = new THREE.Group();
  const digits: { bone: THREE.Group; rest: number; phase: number }[] = [];

  function mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: number[] = [0, 0, 0],
  ) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(position[0], position[1], position[2]);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function hand(material: THREE.Material, mirrored: boolean) {
    const model = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-0.25, -0.55);
    shape.quadraticCurveTo(-0.49, -0.3, -0.45, 0.27);
    shape.quadraticCurveTo(-0.46, 0.43, -0.3, 0.44);
    shape.lineTo(0.32, 0.4);
    shape.quadraticCurveTo(0.47, 0.35, 0.44, 0.14);
    shape.lineTo(0.34, -0.46);
    shape.quadraticCurveTo(0.22, -0.59, -0.25, -0.55);
    const palm = mesh(
      model,
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.15,
        bevelEnabled: true,
        bevelSegments: 5,
        steps: 1,
        bevelSize: 0.075,
        bevelThickness: 0.06,
        curveSegments: 24,
      }),
      material,
      [0, 0, -0.09],
    );
    palm.name = 'Palm';
    mesh(model, new THREE.CylinderGeometry(0.19, 0.23, 0.55, 32), joint, [0.03, -0.78, 0]);
    mesh(model, new THREE.CylinderGeometry(0.245, 0.245, 0.05, 32), mint, [0.03, -0.61, 0]);
    mesh(model, new THREE.CylinderGeometry(0.27, 0.29, 0.48, 32), material, [0.03, -1.02, 0]);
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Group();
      finger.name = `Finger${i}`;
      finger.position.set(-0.34 + i * 0.225, i === 3 ? 0.28 : 0.4, 0);
      finger.rotation.z = [0.13, 0.04, -0.055, -0.18][i];
      finger.rotation.x = [0.14, 0.05, 0.19, 0.36][i];
      model.add(finger);
      let parent = finger;
      const lengths = [0.4, 0.29, 0.23].map(
        (length) => length * (i === 3 ? 0.78 : i === 1 ? 1.08 : 1),
      );
      lengths.forEach((length, index) => {
        const bone = new THREE.Group();
        bone.position.y = index ? lengths[index - 1] : 0;
        bone.rotation.x = index ? 0.08 + i * 0.1 : 0;
        parent.add(bone);
        mesh(bone, new THREE.SphereGeometry(0.085 - index * 0.01, 20, 16), joint);
        mesh(
          bone,
          new THREE.CapsuleGeometry(0.098 - index * 0.012, length - 0.17, 8, 20),
          material,
          [0, length / 2, 0],
        );
        const pin = mesh(
          bone,
          new THREE.CylinderGeometry(0.041, 0.041, 0.194 - index * 0.025, 20),
          index ? joint : mint,
        );
        pin.rotation.z = Math.PI / 2;
        digits.push({ bone, rest: bone.rotation.x, phase: i * 0.7 + index });
        parent = bone;
      });
    }
    const thumb = new THREE.Group();
    thumb.name = 'Thumb';
    thumb.position.set(-0.43, -0.19, 0.055);
    thumb.rotation.set(0.2, -0.2, 0.9);
    model.add(thumb);
    mesh(thumb, new THREE.SphereGeometry(0.135, 24, 20), joint);
    mesh(thumb, new THREE.CapsuleGeometry(0.12, 0.13, 8, 20), material, [0, 0.18, 0]);
    const tip = new THREE.Group();
    tip.position.y = 0.36;
    tip.rotation.x = 0.25;
    thumb.add(tip);
    mesh(tip, new THREE.SphereGeometry(0.09, 20, 16), joint);
    mesh(tip, new THREE.CapsuleGeometry(0.1, 0.1, 8, 20), material, [0, 0.15, 0]);
    for (let i = 0; i < 3; i++) {
      mesh(model, new THREE.BoxGeometry(0.018, 0.21 + i * 0.065, 0.012), mint, [
        -0.08 + i * 0.08,
        -0.04,
        0.127,
      ]);
    }
    for (const x of [-0.27, 0.26]) {
      const screw = mesh(model, new THREE.CylinderGeometry(0.029, 0.029, 0.015, 6), joint, [
        x,
        -0.3,
        0.136,
      ]);
      screw.rotation.x = Math.PI / 2;
    }
    if (mirrored) model.scale.x = -1;
    return model;
  }

  const front = hand(silver, false);
  front.position.set(1.85, 0.05, 0.35);
  front.rotation.set(-0.15, -0.38, -0.27);
  front.scale.multiplyScalar(1.48);
  const back = hand(graphite, true);
  back.position.set(0.85, -0.58, -0.6);
  back.rotation.set(0.35, 0.55, 1.05);
  back.scale.multiplyScalar(1.32);
  root.add(back, front);
  return { root, front, back, digits };
}
