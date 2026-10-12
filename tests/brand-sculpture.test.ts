import { describe, expect, it } from 'vitest';
import { Box3, Mesh, Vector3 } from 'three';
import { createBrandSculpture } from '@/lib/brand-sculpture';
import { disposeRig } from '@/lib/avatar-rig';

describe('original homepage sculpture', () => {
  it('creates two articulated, finite hand meshes without signing clips', () => {
    const sculpture = createBrandSculpture();
    expect(sculpture.root.children).toHaveLength(2);
    expect(sculpture.digits).toHaveLength(24);
    expect(sculpture.root.animations).toHaveLength(0);
    const bounds = new Box3().setFromObject(sculpture.root).getSize(new Vector3());
    expect(bounds.toArray().every((value) => Number.isFinite(value) && value > 0)).toBe(true);
    let meshes = 0;
    sculpture.root.traverse((object) => {
      if (object instanceof Mesh) {
        meshes++;
        expect(object.geometry.getAttribute('position').count).toBeGreaterThan(0);
      }
    });
    expect(meshes).toBeGreaterThan(70);
    disposeRig(sculpture.root);
  });
});
