import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Landing } from '@/components/landing/experience';

export const metadata: Metadata = {
  title: 'SignBridge | Language in motion',
  description:
    'A more expressive future for communication. Explore the SignBridge Indian Sign Language translation prototype and interactive 3D motion studio.',
};

export default async function Page({ searchParams }: { searchParams: Promise<{ text?: string }> }) {
  const { text } = await searchParams;
  if (typeof text === 'string') redirect(`/studio?text=${encodeURIComponent(text)}`);
  return <Landing />;
}
