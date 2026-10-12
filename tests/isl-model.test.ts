import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { HttpIslMotionProvider, islModelStatus } from '../src/lib/isl-model';
import { ISL_MOTION_BONES, islMotionSchema } from '../src/lib/isl-motion-schema';
import { createGeneratedIslClips } from '../src/lib/isl-motion-clips';
import { createDemoRig, disposeRig } from '../src/lib/avatar-rig';
import { LocalIslProvider } from '../src/lib/isl-translation';
import { catalog, assets } from '../src/lib/catalog';
import { testMotion } from './fixtures/isl-motion';
import { srmInputs } from './fixtures/srm-inputs';

describe('ISL motion contract (synthetic, not linguistic accuracy tests)', () => {
  it('accepts full hand articulation and optional non-manual channels', () => {
    expect(
      islMotionSchema.parse(testMotion(srmInputs[2])).segments[0].clip.rotations,
    ).toHaveProperty('RightFinger4End');
  });
  it.each(['ASL', 'isl', 'DGS'])('rejects wrong target language %s', (language) => {
    expect(
      islMotionSchema.safeParse({ ...testMotion('Hello'), targetLanguage: language }).success,
    ).toBe(false);
  });
  it('rejects incomplete text coverage and overlapping segments', () => {
    const motion = testMotion('Hello. What is your name?');
    motion.segments[0].end = 6;
    expect(islMotionSchema.safeParse(motion).success).toBe(false);
    motion.segments.push({ ...motion.segments[0], end: motion.sourceText.length });
    expect(islMotionSchema.safeParse(motion).success).toBe(false);
  });
  it('rejects missing fingers, non-unit rotations, invalid timing and unsafe facial weights', () => {
    const missing = testMotion('Hello');
    delete missing.segments[0].clip.rotations.RightFinger4End;
    expect(islMotionSchema.safeParse(missing).success).toBe(false);
    for (const modify of [
      (m: ReturnType<typeof testMotion>) => {
        m.segments[0].clip.rotations.Head[0] = 1;
      },
      (m: ReturnType<typeof testMotion>) => {
        m.segments[0].clip.times[1] = 0;
      },
      (m: ReturnType<typeof testMotion>) => {
        m.segments[0].clip.expressions!.browLeft![1] = 2;
      },
    ]) {
      const m = testMotion('Hello');
      modify(m);
      expect(islMotionSchema.safeParse(m).success).toBe(false);
    }
  });
  it('rejects missing review evidence, restricted license and executable track fields', () => {
    const m = testMotion('Hello');
    expect(islMotionSchema.safeParse({ ...m, review: { status: 'reviewed' } }).success).toBe(false);
    expect(
      islMotionSchema.safeParse({ ...m, model: { ...m.model, commercialUse: false } }).success,
    ).toBe(false);
    expect(islMotionSchema.safeParse({ ...m, code: 'do not execute' }).success).toBe(false);
  });
  it('creates real mixer tracks and samples arm, finger and facial nodes', () => {
    const motion = testMotion('Playback fixture, not an ISL sign');
    const [clip] = createGeneratedIslClips(motion);
    expect(clip.validate()).toBe(true);
    expect(clip.tracks.length).toBe(ISL_MOTION_BONES.length + 3);
    const { root } = createDemoRig();
    const mixer = new THREE.AnimationMixer(root);
    const arm = root.getObjectByName('RightArm')!;
    const mouth = root.getObjectByName('FaceMouth')!;
    const initial = arm.quaternion.clone();
    const action = mixer.clipAction(clip).play();
    action.time = 0.5;
    mixer.update(0);
    expect(arm.quaternion.angleTo(initial)).toBeGreaterThan(1);
    expect(mouth.scale.y).toBeCloseTo(2.1);
    expect(root.getObjectByName('FaceBrowLeft')!.position.y).toBeCloseTo(0.1);
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
    disposeRig(root);
  });
});

describe('ISL HTTP provider and output routing', () => {
  it('reports absent/invalid configuration without leaking credentials', async () => {
    expect(islModelStatus({} as NodeJS.ProcessEnv).state).toBe('not-configured');
    expect(
      await new HttpIslMotionProvider({} as NodeJS.ProcessEnv).generate('Hello', 'en'),
    ).toBeNull();
    for (const url of [
      'http://192.168.1.2/translate',
      'file:///tmp/model',
      'https://secret:password@example.org/model',
    ]) {
      const status = islModelStatus({ ISL_MODEL_URL: url });
      expect(status.state).toBe('misconfigured');
      expect(status.message).not.toContain('password');
    }
  });
  it('sends the complete paragraph with ISL target and server-only credentials', async () => {
    const text = srmInputs[2];
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(testMotion(text)));
    const provider = new HttpIslMotionProvider(
      { ISL_MODEL_URL: 'http://127.0.0.1:8001/v1/translate', ISL_MODEL_TOKEN: 'test-only-token' },
      transport,
    );
    const result = await new LocalIslProvider(undefined, provider).translate(
      text,
      'en',
      catalog,
      assets.signs,
      { allowUnreviewedModel: true },
    );
    expect(result).toMatchObject({
      targetLanguage: 'ISL',
      outputMode: 'isl',
      playback: 'ready',
      rendering: 'isl-model-motion',
      linguisticConfidence: null,
    });
    expect(result.sequence.every((s) => !s.id.startsWith('asl-'))).toBe(true);
    expect(result.generatedMotion?.sourceText).toBe(text);
    const init = transport.mock.calls[0][1]!;
    expect(JSON.parse(init.body as string)).toMatchObject({
      sourceText: text,
      targetLanguage: 'ISL',
      skeleton: 'signbridge-v1',
    });
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-only-token' });
    expect(init.redirect).toBe('error');
  });
  it("gates unreviewed model output and refuses another input's motion", async () => {
    const provider = new LocalIslProvider(undefined, { generate: async () => testMotion('Hello') });
    const gated = await provider.translate('Hello', 'en', catalog, assets.signs);
    expect(gated.blockReason).toBe('model-review-required');
    expect(gated.status).toBe('supported');
    expect(gated.assetAvailability).toBe('available');
    expect(gated.sequence).toEqual([]);
    const wrong = await provider.translate(
      'Completely different source text',
      'en',
      catalog,
      assets.signs,
      { allowUnreviewedModel: true },
    );
    expect(wrong.blockReason).toBe('model-output-invalid');
    expect(wrong.sequence).toEqual([]);
  });
  it.each([
    () => new Response('bad', { status: 503 }),
    () => new Response('<html/>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{oops', { headers: { 'content-type': 'application/json' } }),
    () => Response.json({ targetLanguage: 'ASL' }),
  ])('handles provider failure without ASL or partial preview substitution', async (response) => {
    const provider = new HttpIslMotionProvider(
      { ISL_MODEL_URL: 'http://localhost:8001/translate' },
      vi.fn<typeof fetch>().mockResolvedValue(response()),
    );
    const result = await new LocalIslProvider(undefined, provider).translate(
      'Hello. Anything else?',
      'en',
      catalog,
      assets.signs,
      { allowReferencePreview: true, allowUnreviewedModel: true },
    );
    expect(result.sequence).toEqual([]);
    expect(result.targetLanguage).toBe('ISL');
    expect(result.blockReason).toMatch(/^model-/);
  });
  it('limits streamed response size and supports cancellation', async () => {
    const provider = new HttpIslMotionProvider(
      { ISL_MODEL_URL: 'http://localhost:8001/translate' },
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(new Uint8Array(8 * 1024 * 1024 + 1), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(provider.generate('Hello', 'en')).rejects.toMatchObject({
      code: 'model-output-invalid',
    });
    const controller = new AbortController();
    controller.abort();
    const aborting = new HttpIslMotionProvider(
      { ISL_MODEL_URL: 'http://localhost:8001/translate' },
      async (_url, init) => {
        init!.signal!.throwIfAborted();
        return Response.json({});
      },
    );
    await expect(aborting.generate('Hello', 'en', controller.signal)).rejects.toBeDefined();
  });
});
