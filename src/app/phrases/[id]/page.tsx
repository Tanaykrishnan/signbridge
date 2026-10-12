import { PhraseDetail } from '@/components/pages';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <PhraseDetail id={(await params).id} />;
}
