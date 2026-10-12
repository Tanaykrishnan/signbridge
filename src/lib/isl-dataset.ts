import { z } from 'zod';
import raw from '../data/isl-csltr.json';
import { normalize } from './translation';

const corpus = z
  .object({
    source: z.url(),
    doi: z.string(),
    authors: z.array(z.string()),
    license: z.literal('CC BY 4.0'),
    licenseUrl: z.url(),
    attribution: z.string(),
    records: z.array(z.object({ text: z.string().min(1), gloss: z.string().min(1) })),
  })
  .parse(raw);

// Source annotations are textual evidence, never an implicit animation mapping.
export function findDatasetGloss(text: string) {
  const record = corpus.records.find((row) => normalize(row.text) === normalize(text));
  return record
    ? {
        ...record,
        source: corpus.source,
        license: corpus.license,
        licenseUrl: corpus.licenseUrl,
        attribution: corpus.attribution,
        animationAvailable: false as const,
      }
    : undefined;
}
