import type { Metadata } from 'next';
import { ParaphraseWorkspace } from '@/components/paraphrase-workspace';
export const metadata: Metadata = { title: 'English language lab | SignBridge' };
export default function Page() {
  return <ParaphraseWorkspace />;
}
