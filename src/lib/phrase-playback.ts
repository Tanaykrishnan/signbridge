import type { Phrase, Sign } from './schemas';

export type PhrasePlayback = 'ready' | 'review-required' | 'asset-missing' | 'unsupported';

// A dictionary match is not permission to play generic test motion as language.
export function phrasePlayback(
  phrase: Phrase | null,
  signs: Sign[],
): {
  state: PhrasePlayback;
  sequence: Sign[];
} {
  if (!phrase) return { state: 'unsupported', sequence: [] };
  if (phrase.review !== 'reviewed' || !phrase.reviewer?.trim())
    return { state: 'review-required', sequence: [] };
  const mapped = phrase.signIds.map((id) => signs.find((s) => s.id === id));
  if (!mapped.length || mapped.some((s) => !s?.available))
    return { state: 'asset-missing', sequence: [] };
  const sequence = mapped as Sign[];
  if (
    sequence.some(
      (s) =>
        s.review !== 'reviewed' || !s.source.trim() || !s.license.trim() || !s.provenance.trim(),
    )
  )
    return { state: 'review-required', sequence: [] };
  return { state: 'ready', sequence };
}
