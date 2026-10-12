import type { Sign, Translation } from './schemas';

export const MAX_TEXT_LENGTH = 5000;
export const ASL_REFERENCE = 'https://www.lifeprint.com/asl101/pages-layout/fingerspelling.htm';
export type FingerPose = [number, number, number, number];
export type LetterPose = {
  fingers: [FingerPose, FingerPose, FingerPose, FingerPose];
  thumb: [number, number, number, number];
  wrist: [number, number, number];
  description: string;
  path?: 'j' | 'z';
};
// Anatomical order: index, middle, ring, little. Values are flexion of three
// joints and lateral spread, in radians. These original poses await signer review.
const straight: FingerPose = [0, 0, 0, 0];
const fist: FingerPose = [1.25, 1.45, 0.8, 0];
const curve: FingerPose = [0.55, 0.75, 0.45, 0];
const pinch: FingerPose = [1, 1.25, 0.8, 0];
const thumbSide: LetterPose['thumb'] = [0.05, 0.05, 0.05, -0.05];
const thumbAcross: LetterPose['thumb'] = [0.75, 0.55, 0.4, 0.9];
function pose(
  fingers: LetterPose['fingers'],
  thumb: LetterPose['thumb'],
  description: string,
  wrist: LetterPose['wrist'] = [0, 0, 0],
  path?: LetterPose['path'],
): LetterPose {
  return { fingers, thumb, description, wrist, path };
}
export const ASL_POSES: Record<string, LetterPose> = {
  A: pose([fist, fist, fist, fist], thumbSide, 'Closed fingers; thumb beside the index finger.'),
  B: pose(
    [straight, straight, straight, straight],
    thumbAcross,
    'Four upright fingers together; thumb across palm.',
  ),
  C: pose(
    [curve, curve, curve, curve],
    [0.35, 0.2, 0.2, -0.5],
    'Curved fingers and thumb form an open C.',
    [0, -0.35, 0],
  ),
  D: pose(
    [straight, pinch, pinch, pinch],
    [1, 0, 0, 0.39],
    'Index upright; remaining fingertips meet thumb.',
  ),
  E: pose(
    [
      [0.6, 1.5, 0.8, 0],
      [0.6, 1.5, 0.8, 0],
      [0.6, 1.5, 0.8, 0],
      [0.6, 1.5, 0.8, 0],
    ],
    [0.85, 0.35, 0.25, 0.95],
    'Bent fingers above the folded thumb.',
  ),
  F: pose(
    [pinch, [0, 0, 0, -0.07], [0, 0, 0, 0.08], [0, 0, 0, 0.2]],
    [0.54, 0.61, 0.36, 0.098],
    'Index and thumb form a circle; other fingers extended.',
  ),
  G: pose(
    [straight, fist, fist, fist],
    [0.1, 0.1, 0.1, -0.3],
    'Index and thumb extended parallel, oriented sideways.',
    [0, -0.5, -Math.PI / 2],
  ),
  H: pose(
    [straight, straight, fist, fist],
    thumbAcross,
    'Index and middle together, oriented sideways.',
    [0, -0.3, -Math.PI / 2],
  ),
  I: pose(
    [fist, fist, fist, straight],
    thumbAcross,
    'Little finger extended; other fingers closed.',
  ),
  J: pose(
    [fist, fist, fist, straight],
    thumbAcross,
    'Little finger traces J; mirrored for the left hand.',
    [0, 0, 0],
    'j',
  ),
  K: pose(
    [[0, 0, 0, -0.18], [0.35, 0, 0, 0.2], fist, fist],
    [0.1, 0.1, 0.1, 0.45],
    'Index and middle form a V; thumb meets base of middle finger.',
  ),
  L: pose(
    [straight, fist, fist, fist],
    [0, 0, 0, -1.05],
    'Upright index and extended thumb form L.',
  ),
  M: pose([fist, fist, fist, fist], [0.4, 0.3, 0.2, 1.15], 'Thumb beneath three closed fingers.'),
  N: pose([fist, fist, fist, fist], [0.35, 0.3, 0.2, 0.7], 'Thumb beneath two closed fingers.'),
  O: pose(
    [pinch, pinch, pinch, pinch],
    [0.54, 0.61, 0.36, 0.098],
    'Curved fingertips and thumb form O.',
    [0, -0.35, 0],
  ),
  P: pose(
    [[0, 0, 0, -0.18], [0.35, 0, 0, 0.2], fist, fist],
    [0.1, 0.1, 0.1, 0.45],
    'K handshape oriented downward.',
    [-2.15, -0.3, 0],
  ),
  Q: pose(
    [straight, fist, fist, fist],
    [0.1, 0.1, 0.1, -0.3],
    'G handshape oriented downward.',
    [-2.15, -0.45, 0],
  ),
  R: pose(
    [[0, 0, 0, 0.17], [0.05, 0, 0, -0.15], fist, fist],
    thumbAcross,
    'Index and middle fingers crossed.',
  ),
  S: pose([fist, fist, fist, fist], thumbAcross, 'Fist with thumb across the front.'),
  T: pose(
    [fist, fist, fist, fist],
    [0.2, 0.2, 0.1, 0.25],
    'Thumb between index and middle fingers.',
  ),
  U: pose([straight, straight, fist, fist], thumbAcross, 'Index and middle upright and together.'),
  V: pose(
    [[0, 0, 0, -0.2], [0, 0, 0, 0.2], fist, fist],
    thumbAcross,
    'Index and middle upright and separated.',
  ),
  W: pose(
    [[0, 0, 0, -0.2], straight, [0, 0, 0, 0.2], fist],
    thumbAcross,
    'Index, middle and ring extended.',
  ),
  X: pose(
    [[0.15, 1.2, 0.7, 0], fist, fist, fist],
    thumbAcross,
    'Index finger hooked; other fingers closed.',
  ),
  Y: pose(
    [fist, fist, fist, [0, 0, 0, 0.15]],
    [0, 0, 0, -1.05],
    'Thumb and little finger extended.',
  ),
  Z: pose(
    [straight, fist, fist, fist],
    thumbAcross,
    'Index traces Z; mirrored for the left hand.',
    [0, 0, 0],
    'z',
  ),
};

function sign(letter: string): Sign {
  return {
    id: `asl-letter-${letter.toLowerCase()}`,
    label: letter,
    gloss: null,
    clip: `asl-letter-${letter.toLowerCase()}`,
    asset: null,
    duration: letter === 'J' || letter === 'Z' ? 1.35 : 0.72,
    transition: 0.16,
    review: 'unreviewed',
    source: ASL_REFERENCE,
    license: 'MIT (original animation code; no reference media bundled)',
    provenance:
      'Original reference-informed ASL alphabet animation. Not expert-reviewed. Left-handed. Fingerspelling, not sentence translation.',
    available: true,
    handshape: ASL_POSES[letter].description,
    movement: ASL_POSES[letter].path ? `Trace ${letter}` : 'Hold letter handshape',
    fallback: 'rest',
  };
}
export const ASL_SIGNS: Sign[] = Object.keys(ASL_POSES).map(sign);
export const ASL_REPEAT_SIGNS: Sign[] = ASL_SIGNS.map((s) => ({
  ...s,
  id: `${s.id}-repeat`,
  clip: `${s.clip}-repeat`,
  movement: 'Small lateral movement distinguishes a repeated letter.',
}));
export const ASL_PAUSE: Sign = {
  ...ASL_SIGNS[0],
  id: 'asl-pause',
  clip: 'asl-pause',
  label: 'Word break',
  duration: 0.32,
  transition: 0.12,
  handshape: 'Relaxed hand',
  movement: 'Pause between words',
};
const digits = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
const symbols: Record<string, string> = {
  '&': 'AND',
  '@': 'AT',
  '%': 'PERCENT',
  '+': 'PLUS',
  $: 'DOLLAR',
  '#': 'HASH',
  '=': 'EQUALS',
  '/': 'SLASH',
};

export function planFingerspelling(
  text: string,
): Pick<Translation, 'sequence' | 'warnings' | 'wordCount'> {
  const sequence: Sign[] = [];
  const warnings = new Set<string>();
  let wordCount = 0;
  let omittedWarnings = 0;
  const lookup = new Map(ASL_SIGNS.map((s) => [s.label, s]));
  const repeats = new Map(ASL_REPEAT_SIGNS.map((s) => [s.label, s]));
  let previousWord = '';
  for (const match of text.matchAll(/\S+/gu)) {
    const sourceWord = match[0];
    const start = match.index;
    const wordIndex = wordCount++;
    const letters: { letter: string; start: number; end: number }[] = [];
    let offset = start;
    for (const char of sourceWord) {
      const end = offset + char.length;
      const normalized = char.normalize('NFKD').replace(/\p{M}/gu, '').toUpperCase();
      if (/^[A-Z]+$/.test(normalized)) {
        if (char.toUpperCase() !== normalized)
          warnings.add('Latin diacritics are rendered using their base letters.');
        for (const letter of normalized) letters.push({ letter, start: offset, end });
      } else if (/^[0-9]$/.test(char)) {
        warnings.add('Digits are fingerspelled as English digit names, not ASL number signs.');
        for (const letter of digits[Number(char)]) letters.push({ letter, start: offset, end });
      } else if (symbols[char]) {
        warnings.add('Common symbols are fingerspelled using their English names.');
        for (const letter of symbols[char]) letters.push({ letter, start: offset, end });
      } else if (/[-–—]/.test(char)) {
        letters.push({ letter: ' ', start: offset, end });
      } else if (!/\p{P}/u.test(char)) {
        if (warnings.size < 48)
          warnings.add(
            `Unsupported character ${JSON.stringify(char)} at position ${offset + 1}; no handshape generated for it.`,
          );
        else omittedWarnings++;
      }
      offset = end;
    }
    if (!letters.some((token) => token.letter !== ' ')) continue;
    if (sequence.length)
      sequence.push({
        ...ASL_PAUSE,
        duration: /[.!?][”'"’)]*$/.test(previousWord) ? 0.65 : ASL_PAUSE.duration,
        token: {
          start,
          end: start,
          wordIndex,
          wordStart: start,
          wordEnd: start + sourceWord.length,
          kind: 'pause',
        },
      });
    for (const token of letters) {
      const isPause = token.letter === ' ';
      const repeated = !isPause && sequence.at(-1)?.label === token.letter;
      const motion = isPause
        ? ASL_PAUSE
        : repeated
          ? repeats.get(token.letter)!
          : lookup.get(token.letter)!;
      sequence.push({
        ...motion,
        token: {
          start: token.start,
          end: token.end,
          wordIndex,
          wordStart: start,
          wordEnd: start + sourceWord.length,
          kind: isPause ? 'pause' : 'letter',
        },
      });
    }
    previousWord = sourceWord;
  }
  if (omittedWarnings)
    warnings.add(
      `${omittedWarnings} additional unsupported characters were skipped; only the first warnings are listed.`,
    );
  return { sequence, warnings: [...warnings], wordCount };
}
