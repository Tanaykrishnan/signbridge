import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  ASL_SIGNS,
  ASL_REPEAT_SIGNS,
  ASL_POSES,
  planFingerspelling,
} from '../src/lib/asl-alphabet';
import { FingerspellingProvider } from '../src/lib/translation';
import { createDemoRig, disposeRig } from '../src/lib/avatar-rig';
import { PlaybackEngine } from '../src/lib/playback';
import { srmInputs } from './fixtures/srm-inputs';

describe('ASL fingerspelling coverage, without claimed sentence translation', () => {
  it.each(srmInputs)('preserves the English letters in %s', async (input) => {
    const result = await new FingerspellingProvider().translate(input, 'en');
    const letters = result.sequence
      .filter((s) => s.token?.kind === 'letter')
      .map((s) => s.label)
      .join('');
    expect(letters).toBe(input.toUpperCase().replace(/[^A-Z]/g, ''));
    expect(result.playback).toBe('ready');
    expect(result.targetLanguage).toBe('ASL');
    expect(result.phrase).toBeNull();
    expect(result.linguisticConfidence).toBeNull();
    expect(result.sequence.every((s) => s.review === 'unreviewed')).toBe(true);
    expect(result.sequence.every((s) => s.token && s.token.end <= input.length)).toBe(true);
  });
  it('handles repeat letters, word boundaries, numbers, symbols and accented names', () => {
    const result = planFingerspelling('Hello. José & 2!');
    expect(result.sequence.find((s) => s.clip === 'asl-letter-l-repeat')).toBeDefined();
    expect(
      result.sequence
        .filter((s) => s.token?.kind === 'letter')
        .map((s) => s.label)
        .join(''),
    ).toBe('HELLOJOSEANDTWO');
    expect(result.sequence.some((s) => s.duration === 0.65 && s.token?.kind === 'pause')).toBe(
      true,
    );
    expect(result.warnings).toHaveLength(3);
    expect(planFingerspelling('A😀中B').warnings).toHaveLength(2);
    expect(planFingerspelling('...').sequence).toHaveLength(0);
    expect(planFingerspelling('---').sequence).toHaveLength(0);
    expect(planFingerspelling('€').warnings).toHaveLength(1);
    expect(planFingerspelling('中'.repeat(5000)).warnings!.length).toBeLessThan(51);
  });
  it('accepts the full practical limit and seeks the final motion', () => {
    const result = planFingerspelling('a'.repeat(5000));
    expect(result.sequence).toHaveLength(5000);
    expect(JSON.stringify(result).length).toBeLessThan(5_000_000);
    expect(result.sequence[4999].token).toMatchObject({
      start: 4999,
      end: 5000,
      wordStart: 0,
      wordEnd: 5000,
    });
    const player = new PlaybackEngine();
    player.setSequence(result.sequence);
    player.seekIndex(4999);
    expect(player.getSnapshot().index).toBe(4999);
    player.seek(0);
    expect(player.getSnapshot().index).toBe(0);
    player.setSequence([]);
    expect(player.getSnapshot().duration).toBe(0);
  });
  it('has actual bound animation tracks for every letter and distinct motion for J/Z', () => {
    const rig = createDemoRig();
    try {
      expect(Object.keys(ASL_POSES)).toHaveLength(26);
      for (const sign of [...ASL_SIGNS, ...ASL_REPEAT_SIGNS]) {
        const clip = rig.clips.find((c) => c.name === sign.clip)!;
        expect(clip).toBeDefined();
        for (const track of clip.tracks) {
          expect(rig.root.getObjectByName(track.name.split('.')[0])).toBeDefined();
          expect([...track.values].every(Number.isFinite)).toBe(true);
        }
      }
      for (const letter of ['j', 'z']) {
        const clip = rig.clips.find((c) => c.name === `asl-letter-${letter}`)!;
        const mixer = new THREE.AnimationMixer(rig.root);
        const action = mixer.clipAction(clip).play();
        action.time = 0.05;
        mixer.update(0);
        const before = rig.root.getObjectByName('RightHand')!.position.clone();
        action.time = clip.duration * 0.73;
        mixer.update(0);
        expect(before.distanceTo(rig.root.getObjectByName('RightHand')!.position)).toBeGreaterThan(
          0.03,
        );
        mixer.stopAllAction();
        mixer.uncacheRoot(rig.root);
      }
    } finally {
      disposeRig(rig.root);
    }
  });
  it('keeps source offsets aligned after trimming and leaves unavailable languages unsupported', async () => {
    const provider = new FingerspellingProvider();
    const result = await provider.translate('  Hi  ', 'en');
    expect(result.sequence[0].token).toMatchObject({ start: 0, end: 1, wordStart: 0, wordEnd: 2 });
    expect((await provider.translate('Hello', 'hi')).status).toBe('unsupported');
  });
  it('brings F/D/O fingertips to the thumb and directs P/Q downward', () => {
    const rig = createDemoRig();
    const mixer = new THREE.AnimationMixer(rig.root);
    const endpoint = (name: string, length: number) =>
      rig.root.getObjectByName(name)!.localToWorld(new THREE.Vector3(0, -length, 0));
    try {
      for (const letter of ['f', 'd', 'o', 'p', 'q']) {
        mixer.stopAllAction();
        mixer.clipAction(rig.clips.find((c) => c.name === `asl-letter-${letter}`)!).play();
        mixer.update(0);
        rig.root.updateMatrixWorld(true);
        if (['p', 'q'].includes(letter)) {
          const base = rig.root
            .getObjectByName('RightFinger3')!
            .getWorldPosition(new THREE.Vector3());
          expect(endpoint('RightFinger3End', 0.021).y).toBeLessThan(base.y);
        } else {
          expect(
            endpoint(letter === 'd' ? 'RightFinger2End' : 'RightFinger3End', 0.021).distanceTo(
              endpoint('RightFinger4End', 0.018),
            ),
          ).toBeLessThan(0.012);
        }
      }
    } finally {
      mixer.stopAllAction();
      mixer.uncacheRoot(rig.root);
      disposeRig(rig.root);
    }
  });
});
