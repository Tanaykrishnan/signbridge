import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, body, session } from '@/lib/api';
import { generateParaphrase, ParaphraseError } from '@/lib/paraphrase';
import { paraphraseInputSchema } from '@/lib/paraphrase-schema';
import { paraphraseHistory, saveParaphrase } from '@/lib/paraphrase-store';
export const runtime = 'nodejs';
export const maxDuration = 180;
function respond(data: unknown, cookie: string | null, status = 200) {
  const response = NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  if (cookie) response.headers.set('Set-Cookie', cookie);
  return response;
}
function failure(error: unknown) {
  if (error instanceof ApiError || error instanceof ParaphraseError)
    return respond({ error: error.message }, null, error.status);
  if (error instanceof z.ZodError)
    return respond({ error: error.issues[0]?.message || 'Invalid input.' }, null, 400);
  return respond({ error: 'The paraphrasing workspace is unavailable.' }, null, 503);
}
export async function GET(request: Request) {
  try {
    const guest = await session(request);
    return respond(
      { items: await paraphraseHistory(guest.id), storage: 'local-file', limit: 50 },
      guest.cookie,
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    const expected =
      process.env.APP_ORIGIN || `${url.protocol}//${request.headers.get('host') || url.host}`;
    if (origin && origin !== expected)
      throw new ApiError(403, 'Cross-origin requests are not allowed.');
    const input = paraphraseInputSchema.parse(await body(request));
    const guest = await session(request);
    const result = await generateParaphrase(input.text, input.strategy, request.signal);
    try {
      await saveParaphrase(guest.id, result);
      result.persistence = 'saved-local';
    } catch {
      result.persistence = 'not-saved';
    }
    return respond(result, guest.cookie);
  } catch (error) {
    return failure(error);
  }
}
