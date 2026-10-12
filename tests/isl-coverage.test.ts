import { describe, expect, it } from 'vitest';
import { localIslFailure } from '../src/lib/isl-local-model';
import { LocalIslProvider } from '../src/lib/isl-translation';
import { lexicalMappingSchema } from '../src/lib/isl-motion-schema';
import { catalog, assets } from '../src/lib/catalog';

describe('structured ISL coverage diagnostics', () => {
  it('retains exact missing words without parsing a human-readable message', async () => {
    const issue = localIslFailure(422, {
      error: 'No available motion.',
      code: 'vocabulary-unavailable',
      unsupportedWords: ['Zzyqx', 'quantumfluff'],
    });
    const provider = new LocalIslProvider(undefined, {
      scope: 'local-research',
      generate: async () => {
        throw issue;
      },
    });
    const result = await provider.translate(
      'My name is Zzyqx. I study quantumfluff.',
      'en',
      catalog,
      assets.signs,
      { allowUnreviewedModel: true },
    );
    expect(result.blockReason).toBe('model-vocabulary-unavailable');
    expect(result.unsupportedWords).toEqual(['Zzyqx', 'quantumfluff']);
    expect(result.sequence).toEqual([]);
    expect(result.targetLanguage).toBe('ISL');
  });
  it('does not misreport sentence limits as missing vocabulary', async () => {
    const issue = localIslFailure(422, {
      error: 'A sentence exceeds 24 sign units. Split it into shorter sentences.',
      code: 'input-unsupported',
    });
    expect(issue.code).toBe('model-input-unsupported');
    expect(issue.unsupportedWords).toEqual([]);
    const provider = new LocalIslProvider(undefined, {
      scope: 'local-research',
      generate: async () => {
        throw issue;
      },
    });
    const result = await provider.translate('Long input.', 'en', catalog, assets.signs, {
      allowUnreviewedModel: true,
    });
    expect(result.blockReason).toBe('model-input-unsupported');
    expect(result.message).toContain('24 sign units');
    expect(result.unsupportedWords).toBeUndefined();
  });
  it('does not accept malformed or unrelated failure metadata as a vocabulary diagnosis', () => {
    expect(
      localIslFailure(500, { error: 'Inference failed', unsupportedWords: ['invented'] })
        .unsupportedWords,
    ).toEqual([]);
    expect(
      localIslFailure(422, {
        error: 'Invalid metadata',
        code: 'vocabulary-unavailable',
        unsupportedWords: [123],
      }).code,
    ).toBe('model-unavailable');
  });
  it('requires explicit unreviewed status for the contextual mapping evidence', () => {
    const mapping = {
      source: 'way',
      target: 'Direction',
      rule: 'spatial-directions-v1',
      review: 'unreviewed',
    };
    expect(lexicalMappingSchema.safeParse(mapping).success).toBe(true);
    expect(lexicalMappingSchema.safeParse({ ...mapping, review: 'reviewed' }).success).toBe(false);
    expect(
      lexicalMappingSchema.safeParse({ ...mapping, rule: 'invented-synonym-rule' }).success,
    ).toBe(false);
  });
});
