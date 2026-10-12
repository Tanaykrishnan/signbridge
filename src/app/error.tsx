'use client';
import { ErrorState } from '@/components/ui';
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      message="The workspace could not load. Your saved records have not been changed."
      retry={reset}
    />
  );
}
