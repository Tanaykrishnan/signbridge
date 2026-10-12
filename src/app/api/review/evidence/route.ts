import { readReviewEvidence } from '@/lib/review-evidence';
import { REVIEW_SCENARIOS } from '@/lib/review-scenarios';
export const runtime = 'nodejs';
export async function GET() {
  return Response.json(
    { report: await readReviewEvidence(), scenarios: REVIEW_SCENARIOS },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
