import { describe, expect, it } from 'vitest';
import { catalog, assets } from '../src/lib/catalog';
import { normalize, DictionaryProvider } from '../src/lib/translation';
import { translateSchema } from '../src/lib/schemas';
describe('translation pipeline', () => {
  const provider = new DictionaryProvider();
  it('normalizes case, unicode forms, spacing, and punctuation', () => {
    expect(normalize('  HELLO!!  ')).toBe('hello');
    expect(normalize('Ｔｈａｎｋ　ｙｏｕ')).toBe('thank you');
  });
  it('matches only supported exact phrases and explicit aliases', async () => {
    const a = await provider.translate('  Hello! ', 'en', catalog, assets.signs);
    expect(a.match).toBe('exact');
    expect(a.phrase?.id).toBe('hello');
    expect(a.sequence).toEqual([]);
    expect(a.playback).toBe('review-required');
    expect(a.linguisticConfidence).toBeNull();
    expect(a.phrase?.review).toBe('unreviewed');
    const b = await provider.translate('hi', 'en', catalog, assets.signs);
    expect(b.match).toBe('alias');
  });
  it('does not stitch word substitutions for unsupported sentences', async () => {
    const r = await provider.translate(
      'Hello I am going to the library',
      'en',
      catalog,
      assets.signs,
    );
    expect(r.status).toBe('unsupported');
    expect(r.sequence).toEqual([]);
  });
  it('rejects unsupported language and handles missing assets honestly', async () => {
    expect((await provider.translate('hello', 'hi', catalog, assets.signs)).status).toBe(
      'unsupported',
    );
    const r = await provider.translate('Where is the library?', 'en', catalog, assets.signs);
    expect(r.assetAvailability).toBe('missing');
    expect(r.sequence).toEqual([]);
  });
  it('validates empty, oversized and unexpected fields', () => {
    for (const text of ['', '   ', 'a'.repeat(5001)])
      expect(translateSchema.safeParse({ text }).success).toBe(false);
    expect(translateSchema.safeParse({ text: 'hello', secret: 'x' }).success).toBe(false);
  });
  it('never reuses generic fixtures as translations, including legacy stored mappings', async () => {
    for (const phrase of catalog) {
      const result = await provider.translate(phrase.text, 'en', catalog, assets.signs);
      expect(result.phrase?.id).toBe(phrase.id);
      expect(result.sequence).toEqual([]);
      expect(result.playback).toBe('review-required');
    }
  });
  it('selects distinct explicitly mapped reviewed assets and preserves aliases', async () => {
    // Synthetic review flags exercise routing only; these records are never seeded into the app.
    const signs = ['a', 'b'].map((id) => ({
      ...assets.signs[0],
      id,
      clip: `test-only-${id}`,
      review: 'reviewed' as const,
    }));
    const phrases = catalog.slice(0, 2).map((p, index) => ({
      ...p,
      review: 'reviewed' as const,
      reviewer: 'Unit-test fixture only',
      signIds: [signs[index].id],
    }));
    expect((await provider.translate('Hello', 'en', phrases, signs)).sequence[0].clip).toBe(
      'test-only-a',
    );
    expect((await provider.translate('Thank you', 'en', phrases, signs)).sequence[0].clip).toBe(
      'test-only-b',
    );
    expect((await provider.translate('hi', 'en', phrases, signs)).sequence[0].clip).toBe(
      'test-only-a',
    );
    expect((await provider.translate('Hello', 'en', phrases, [])).playback).toBe('asset-missing');
    expect(
      (await provider.translate('Hello', 'en', [{ ...phrases[0], reviewer: null }], signs))
        .sequence,
    ).toEqual([]);
    expect(
      (await provider.translate('Hello', 'en', phrases, [{ ...signs[0], review: 'illustrative' }]))
        .sequence,
    ).toEqual([]);
  });
});
