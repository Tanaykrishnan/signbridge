import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ParaphraseResult } from './paraphrase-schema';
export interface ReviewEvidence {
  generatedAt: string;
  model: string;
  protocol: string;
  samples: {
    scenarioId: string;
    objective: string;
    requiredTerms: string[];
    missingTerms: string[];
    result: ParaphraseResult | null;
    error?: string;
  }[];
  summaries: {
    strategy: string;
    successfulRuns: number;
    totalRuns: number;
    meanLatencyMs: number;
    literalTermsFound: number;
    literalTermsTotal: number;
    heuristicWarnings: number;
  }[];
  note: string;
}
export async function readReviewEvidence(): Promise<ReviewEvidence | null> {
  try {
    return JSON.parse(
      await fs.readFile(path.join(process.cwd(), 'outputs/review2-evidence.json'), 'utf8'),
    );
  } catch {
    return null;
  }
}
