import { notFound } from 'next/navigation';
import { Dashboard, HistoryPage, Library, SettingsPage, InformationPage } from '@/components/pages';
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === 'dashboard') return <Dashboard />;
  if (section === 'history') return <HistoryPage />;
  if (section === 'favorites') return <Library savedOnly />;
  if (section === 'library') return <Library />;
  if (section === 'settings') return <SettingsPage />;
  if (section === 'about' || section === 'privacy' || section === 'help')
    return <InformationPage kind={section} />;
  notFound();
}
