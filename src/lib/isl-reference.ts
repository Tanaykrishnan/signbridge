import { phraseSchema, signSchema } from './schemas';

export const ISL_REFERENCE = 'https://nish.ac.in/docs/EIP_Magazine_2020.pdf#page=21';
const entries = [
  {
    id: 'hello',
    text: 'Hello',
    aliases: ['hi', 'hey'],
    category: 'greetings',
    shape: 'Open hand at the temple, then outward.',
  },
  {
    id: 'thank-you',
    text: 'Thank you',
    aliases: ['thanks'],
    category: 'everyday',
    shape: 'Open hand near the chin, then forward.',
  },
  {
    id: 'namaste',
    text: 'Namaste',
    aliases: [],
    category: 'greetings',
    shape: 'Both upright palms meet in front of the chest.',
  },
  {
    id: 'sorry',
    text: 'Sorry',
    aliases: [],
    category: 'everyday',
    shape: 'Closed hand moves in a small circle at the chest.',
  },
  {
    id: 'bye',
    text: 'Bye',
    aliases: ['goodbye'],
    category: 'greetings',
    shape: 'Raised open hand waves laterally.',
  },
  {
    id: 'how-are-you',
    text: 'How are you?',
    aliases: ['how are you'],
    category: 'everyday',
    shape: 'Two open hands move down, followed by two thumbs-up handshapes.',
  },
  {
    id: 'good-morning',
    text: 'Good morning',
    aliases: [],
    category: 'greetings',
    shape: 'Thumb-up near chest followed by an open hand moving up beside the head.',
  },
] as const;

export const ISL_REFERENCE_SIGNS = entries.map((entry) =>
  signSchema.parse({
    id: `isl-reference-${entry.id}`,
    label: entry.text,
    gloss: null,
    clip: `isl-reference-${entry.id}`,
    asset: null,
    duration: entry.id === 'how-are-you' || entry.id === 'good-morning' ? 3.4 : 2.8,
    transition: 0.12,
    review: 'unreviewed',
    source: ISL_REFERENCE,
    license: 'MIT (original code and numeric animation data only; reference media not bundled)',
    provenance:
      'Original approximation informed by the NISH greeting chart, printed page 36 / PDF page 21. No expert has reviewed this animation. Dominant left hand; non-manual grammar is not reconstructed.',
    available: true,
    handshape: entry.shape,
    movement: entry.shape,
    facialExpression: 'Not reconstructed; the mannequin has no fluent facial grammar.',
    fallback: 'rest',
  }),
);
export const ISL_REFERENCE_PHRASES = entries.map((entry) =>
  phraseSchema.parse({
    id: entry.id,
    text: entry.text,
    aliases: [...entry.aliases],
    language: 'en',
    category: entry.category,
    description:
      'Original ISL reference-animation preview. Not expert-reviewed; consult the linked NISH source rather than relying on this rendering for interpretation.',
    review: 'unreviewed',
    source: ISL_REFERENCE,
    license: 'MIT (original text metadata and animation code; no reference images redistributed)',
    reviewer: null,
    signIds: [`isl-reference-${entry.id}`],
  }),
);

export function isReferencePhrase(id: string) {
  return ISL_REFERENCE_PHRASES.some((p) => p.id === id);
}
