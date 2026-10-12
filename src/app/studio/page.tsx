import type { Metadata } from 'next';
import { Translator } from '@/components/translator';
import { MAX_TEXT_LENGTH } from '@/lib/asl-alphabet';

export const metadata: Metadata = { title: 'Translation studio | SignBridge' };

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialMode =
    params.mode === 'fingerspelling'
      ? 'fingerspelling'
      : params.mode === 'lab'
        ? 'lab'
        : 'translation';
  const initialText = typeof params.text === 'string' ? params.text.slice(0, MAX_TEXT_LENGTH) : '';
  const reviewedOnly = params.reviewedOnly === '1';
  return (
    <Translator
      key={`${initialMode}:${reviewedOnly}:${initialText}`}
      initialMode={initialMode}
      initialText={initialText}
      reviewedOnly={reviewedOnly}
    />
  );
}
