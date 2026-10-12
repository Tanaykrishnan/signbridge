import type { Metadata } from 'next';
import { ReviewWorkspace } from '@/components/review-workspace';
export const metadata: Metadata = { title: 'Review 2 evidence | SignBridge' };
export default function Page() {
  return <ReviewWorkspace />;
}
