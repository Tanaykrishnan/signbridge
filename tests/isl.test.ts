import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LocalIslProvider } from '../src/lib/isl-translation';
import { ISL_REFERENCE_SIGNS, ISL_REFERENCE_PHRASES } from '../src/lib/isl-reference';
import { catalog, assets } from '../src/lib/catalog';
import { createDemoRig, disposeRig } from '../src/lib/avatar-rig';
import { solveArm } from '../src/lib/isl-clips';
import { findDatasetGloss } from '../src/lib/isl-dataset';
import { srmInputs } from './fixtures/srm-inputs';
import { DictionaryProvider } from '../src/lib/translation';

const provider = new LocalIslProvider();
const options = { allowReferencePreview: true };
const translate = (text: string) => provider.translate(text, 'en', catalog, assets.signs, options);

describe('local ISL routing with explicit review boundaries', () => {
  it('gives an injected reviewed engine priority over reference approximations', async () => {
    // Synthetic review metadata is local to this routing test, never seeded.
    const phrase = {
      ...ISL_REFERENCE_PHRASES[0],
      review: 'reviewed' as const,
      reviewer: 'Test fixture',
      signIds: ['test-only-reviewed'],
    };
    const sign = {
      ...ISL_REFERENCE_SIGNS[0],
      id: 'test-only-reviewed',
      clip: 'test-only-reviewed',
      review: 'reviewed' as const,
    };
    const reviewedProvider = {
      id: 'test-only-engine',
      translate: async (text: string, language: string) =>
        new DictionaryProvider().translate(text, language, [phrase], [sign]),
    };
    const r = await new LocalIslProvider(reviewedProvider).translate(
      'Hello',
      'en',
      catalog,
      assets.signs,
      options,
    );
    expect(r.rendering).toBe('reviewed-isl');
    expect(r.sequence[0].id).toBe('test-only-reviewed');
  });
  it('keeps reviewed-only API behavior unless preview is enabled', async () => {
    const result = await provider.translate('Hello', 'en', catalog, assets.signs);
    expect(result.playback).toBe('review-required');
    expect(result.sequence).toEqual([]);
  });
  it('matches all seven original reference motions without claiming expert review', async () => {
    const ids = new Set<string>();
    for (const phrase of ISL_REFERENCE_PHRASES) {
      const r = await translate(phrase.text);
      expect(r).toMatchObject({
        rendering: 'isl-reference-preview',
        playback: 'ready',
        targetLanguage: 'ISL',
        linguisticConfidence: null,
      });
      expect(r.sequence).toHaveLength(1);
      expect(r.sequence[0].review).toBe('unreviewed');
      ids.add(r.sequence[0].clip);
    }
    expect(ids.size).toBe(7);
    expect((await translate(' THANKS! ')).phrase?.id).toBe('thank-you');
  });
  it('sequences complete supported utterances and preserves their source offsets', async () => {
    const result = await translate('Hello!\n Thank you. How are you?');
    expect(result.phraseMatches?.map((p) => p.id)).toEqual(['hello', 'thank-you', 'how-are-you']);
    expect(
      result.sequence.map((s) => result.sourceText.slice(s.token!.start, s.token!.end)),
    ).toEqual(['Hello!', 'Thank you.', 'How are you?']);
    expect(result.sequence.every((s) => s.token?.kind === 'phrase')).toBe(true);
  });
  it('never drops unknown text when part of a paragraph matches', async () => {
    const text = 'Hello. What is your name? Thank you.';
    const result = await translate(text);
    expect(result).toMatchObject({
      targetLanguage: 'ISL',
      requestedLanguage: 'ISL',
      rendering: 'none',
      outputMode: 'isl',
      blockReason: 'model-not-configured',
    });
    expect(result.sourceText).toBe(text);
    expect(result.sequence).toEqual([]);
    expect(result.phrase).toBeNull();
  });
  it.each(srmInputs)('accepts campus text without inventing ISL: %s', async (text) => {
    const result = await translate(text);
    expect(result.sourceText).toBe(text);
    expect(result.playback).toBe('unsupported');
    expect(result.targetLanguage).toBe('ISL');
    expect(result.sequence).toEqual([]);
  });
  it('never falls back and honors unavailable reference assets', async () => {
    const unknown = await provider.translate('What is your name?', 'en', catalog, assets.signs, {
      allowReferencePreview: true,
    });
    expect(unknown.playback).toBe('unsupported');
    expect(unknown.sequence).toEqual([]);
    const missing = await provider.translate('Hello', 'en', catalog, [], {
      allowReferencePreview: true,
    });
    expect(missing.sequence).toEqual([]);
    expect(missing.assetAvailability).toBe('missing');
    const language = await provider.translate('Hello', 'hi', catalog, assets.signs, options);
    expect(language.sequence).toEqual([]);
  });
  it('does not substitute an altered or generic asset for a whitelisted reference', async () => {
    const altered = assets.signs.map((s) =>
      s.id === 'isl-reference-hello' ? { ...s, clip: 'demo-open' } : s,
    );
    const result = await provider.translate('Hello', 'en', catalog, altered, {
      allowReferencePreview: true,
    });
    expect(result.sequence).toEqual([]);
  });
  it('retrieves attributed dataset glosses without treating them as installed motion', async () => {
    const result = await translate('Are you free today?');
    expect(result.datasetMatch).toMatchObject({
      gloss: 'YOU FREE TODAY',
      license: 'CC BY 4.0',
      animationAvailable: false,
    });
    expect(result.targetLanguage).toBe('ISL');
    expect(findDatasetGloss('are you free next week')).toBeUndefined();
    expect(findDatasetGloss('what is your name')).toBeUndefined();
  });
});

describe('reference animation geometry', () => {
  it('solves reachable wrist targets and remains finite for coincident endpoints', () => {
    const shoulder = new THREE.Vector3(0.29, 1.4, 0);
    for (const target of [
      new THREE.Vector3(0.16, 1.57, 0.19),
      new THREE.Vector3(0.025, 1.4, 0.43),
    ]) {
      const solved = solveArm(shoulder, target, 1);
      const wrist = shoulder
        .clone()
        .add(new THREE.Vector3(0, -0.31, 0).applyQuaternion(solved.upper))
        .add(new THREE.Vector3(0, -0.28, 0).applyQuaternion(solved.lowerWorld));
      expect(wrist.distanceTo(target)).toBeLessThan(1e-6);
    }
    expect(solveArm(shoulder, shoulder, 1).upper.toArray().every(Number.isFinite)).toBe(true);
  });
  it('animates distinct hand positions, both hands for Namaste, and real finger joints', () => {
    const { root, clips } = createDemoRig();
    const mixer = new THREE.AnimationMixer(root);
    const positions: THREE.Vector3[] = [];
    for (const sign of ISL_REFERENCE_SIGNS) {
      mixer.stopAllAction();
      const clip = clips.find((c) => c.name === sign.clip)!;
      expect(clip.validate()).toBe(true);
      expect(clip.tracks.some((t) => t.name === 'RightFinger4End.quaternion')).toBe(true);
      const action = mixer.clipAction(clip).play();
      action.time = clip.duration * 0.5;
      mixer.update(0);
      root.updateMatrixWorld(true);
      const right = root.getObjectByName('RightHand')!.getWorldPosition(new THREE.Vector3());
      positions.push(right);
      if (sign.id === 'isl-reference-namaste') {
        const left = root.getObjectByName('LeftHand')!.getWorldPosition(new THREE.Vector3());
        expect(right.distanceTo(left)).toBeCloseTo(0.052, 3);
      }
    }
    expect(positions[0].distanceTo(positions[1])).toBeGreaterThan(0.1);
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
    disposeRig(root);
  });
});
