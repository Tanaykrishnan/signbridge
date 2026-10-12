import { paraphraseStatus } from '@/lib/paraphrase';
export const runtime = 'nodejs';
export async function GET() {
  return Response.json(await paraphraseStatus(), { headers: { 'Cache-Control': 'no-store' } });
}
