import type { Phrase, Sign, Translation } from './schemas';
import { phrasePlayback } from './phrase-playback';
import { ASL_REFERENCE, planFingerspelling } from './asl-alphabet';
export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function preprocess(text: string) {
  return { normalized: normalize(text), tokens: normalize(text).split(' ').filter(Boolean) };
}
export interface TranslationProvider {
  id: string;
  translate(text: string, language: string, phrases: Phrase[], signs: Sign[]): Promise<Translation>;
}
export class DictionaryProvider implements TranslationProvider {
  id = 'review-aware-phrase-dictionary-v1';
  async translate(
    text: string,
    language: string,
    phrases: Phrase[],
    signs: Sign[],
  ): Promise<Translation> {
    const { normalized } = preprocess(text);
    const phrase =
      language === 'en'
        ? (phrases.find(
            (p) =>
              normalize(p.text) === normalized ||
              p.aliases.some((a) => normalize(a) === normalized),
          ) ?? null)
        : null;
    const playback = phrasePlayback(phrase, signs);
    const sequence = playback.sequence;
    const available = sequence.filter((s) => s.available).length;
    return {
      status: phrase ? 'supported' : 'unsupported',
      sourceText: text.trim(),
      normalized,
      language,
      phrase,
      sequence,
      playback: playback.state,
      match: phrase ? (normalize(phrase.text) === normalized ? 'exact' : 'alias') : null,
      provenance: phrase?.source ?? 'No dictionary match. No translation generated.',
      linguisticConfidence: null,
      assetAvailability:
        available === 0
          ? 'missing'
          : available === sequence.length && sequence.length === phrase?.signIds.length
            ? 'available'
            : 'partial',
      message: !phrase
        ? 'This phrase is outside the supported dictionary. Try a phrase from the library.'
        : playback.state === 'ready'
          ? 'Reviewed phrase and motion assets matched. See provenance before use.'
          : playback.state === 'asset-missing'
            ? 'This phrase has no complete animation asset set. No substitute motion will be played.'
            : 'Phrase found, but a reviewed ISL animation is not available. Generic demo motions are not a translation of this text.',
    };
  }
}
export class FingerspellingProvider implements TranslationProvider {
  id = 'asl-reference-fingerspelling-v1';
  async translate(text: string, language: string): Promise<Translation> {
    text = text.trim();
    const plan =
      language === 'en'
        ? planFingerspelling(text)
        : { sequence: [], warnings: ['Only English input is enabled.'], wordCount: 0 };
    const available = plan.sequence.some((s) => s.token?.kind === 'letter');
    return {
      ...plan,
      status: available ? 'supported' : 'unsupported',
      sourceText: text.trim(),
      normalized: normalize(text),
      language,
      phrase: null,
      playback: available ? 'ready' : 'unsupported',
      match: null,
      provenance: ASL_REFERENCE,
      linguisticConfidence: null,
      assetAvailability: available ? 'available' : 'missing',
      outputMode: 'asl-fingerspelling',
      targetLanguage: 'ASL',
      message: available
        ? 'Your text is spelled using the ASL manual alphabet. Original animations await expert review. This preserves letters, not ASL sentence grammar or meaning.'
        : 'No supported English letters or digits were found. Nothing has been substituted.',
    };
  }
}
export const translationProvider: TranslationProvider = new DictionaryProvider();
export const fingerspellingProvider = new FingerspellingProvider();
