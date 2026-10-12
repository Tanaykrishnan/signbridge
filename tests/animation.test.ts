import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AnimationRegistry } from '../src/lib/registry';
import { assets } from '../src/lib/catalog';
import { PlaybackEngine } from '../src/lib/playback';
import { createDemoRig, disposeRig, remapClip } from '../src/lib/avatar-rig';
describe('animation registry', () => {
  it('finds missing references and clips', () => {
    const r = new AnimationRegistry(assets);
    expect(r.resolve(['unknown'])[0].missing).toBe(true);
    expect(r.missingClips(['demo-rest'])).toHaveLength(9);
  });
  it('rejects duplicate IDs, invalid durations and remote URLs', () => {
    expect(
      () => new AnimationRegistry({ ...assets, signs: [assets.signs[0], assets.signs[0]] }),
    ).toThrow();
    expect(
      () => new AnimationRegistry({ ...assets, signs: [{ ...assets.signs[0], duration: -1 }] }),
    ).toThrow();
    expect(
      () =>
        new AnimationRegistry({
          ...assets,
          avatar: { ...assets.avatar, url: 'https://example.com/model.glb' },
        }),
    ).toThrow();
  });
  it('articulates real bones through AnimationMixer and supports name mapping', () => {
    const { root, clips } = createDemoRig();
    const bone = root.getObjectByName('RightArm')!;
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clips[0]).play();
    mixer.update(0.7);
    expect(Math.abs(bone.quaternion.x)).toBeGreaterThan(0.1);
    const mapped = remapClip(clips[0], { RightArm: 'arm_R' });
    expect(mapped.tracks[0].name).toBe('arm_R.quaternion');
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
    disposeRig(root);
  });
});
describe('playback state', () => {
  it('blends during continuous playback but samples the selected pose immediately on manual seek', () => {
    const e = new PlaybackEngine();
    e.setSequence([
      { id: 'a', duration: 0.1 },
      { id: 'b', duration: 1 },
    ]);
    e.play();
    e.tick(0.15);
    expect(e.getSnapshot()).toMatchObject({ index: 1, transitionFrom: 0 });
    e.seekIndex(1);
    expect(e.getSnapshot()).toMatchObject({ index: 1, localTime: 0, transitionFrom: null });
  });
  it('plays, pauses, resumes, seeks, sequences and completes', () => {
    const e = new PlaybackEngine();
    e.setSequence([
      { id: 'a', duration: 1 },
      { id: 'b', duration: 2 },
    ]);
    e.play();
    e.tick(0.1);
    expect(e.getSnapshot().time).toBeCloseTo(0.1);
    e.pause();
    e.tick(0.1);
    expect(e.getSnapshot().time).toBeCloseTo(0.1);
    e.resume();
    e.setSpeed(0.5);
    e.tick(0.2);
    expect(e.getSnapshot().time).toBeCloseTo(0.2);
    e.next();
    expect(e.getSnapshot().index).toBe(1);
    e.seek(3);
    expect(e.getSnapshot().phase).toBe('complete');
    e.play();
    expect(e.getSnapshot().time).toBe(0);
    e.seek(1.5);
    expect(e.getSnapshot().localTime).toBe(0.5);
    e.previous();
    expect(e.getSnapshot().index).toBe(0);
    e.stop();
    expect(e.getSnapshot().phase).toBe('idle');
  });
  it('clamps seeking and prevents invalid state', () => {
    const e = new PlaybackEngine();
    e.play();
    expect(e.getSnapshot().phase).toBe('idle');
    expect(() => e.setSpeed(0)).toThrow();
    expect(() => e.setSequence([{ id: 'invalid', duration: 0 }])).toThrow();
    e.setSequence([{ id: 'a', duration: 2 }]);
    e.seek(-9);
    expect(e.getSnapshot().time).toBe(0);
    e.seek(50);
    expect(e.getSnapshot().time).toBe(2);
    e.tick(NaN);
    expect(e.getSnapshot().time).toBe(2);
  });
});
