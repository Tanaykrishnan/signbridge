import phrases from '@/data/phrases.json';
import manifest from '../../public/assets/signs/manifest.json';
import { phraseSchema } from './schemas';
import { AnimationRegistry } from './registry';
import { ISL_REFERENCE_PHRASES, ISL_REFERENCE_SIGNS } from './isl-reference';
const records = new Map(phrases.map((p) => [p.id, phraseSchema.parse(p)]));
ISL_REFERENCE_PHRASES.forEach((p) => records.set(p.id, p));
export const catalog = [...records.values()];
export const assets = new AnimationRegistry({
  ...manifest,
  signs: [...manifest.signs, ...ISL_REFERENCE_SIGNS],
}).manifest;
