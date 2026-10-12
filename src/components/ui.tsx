'use client';
import { LoaderCircle, AlertCircle, SearchX, ArrowLeft, ArrowRight } from 'lucide-react';
import { Tip } from './providers';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <Tip label={label}>
      <button
        {...props}
        type={props.type || 'button'}
        className={`icon-button ${props.className || ''}`}
        aria-label={label}
      >
        {children}
      </button>
    </Tip>
  );
}
export function Badge({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'teal' | 'amber';
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>{label}...</span>
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <AlertCircle />
      <h3>Something needs attention</h3>
      <p>{message}</p>
      {retry && (
        <button className="button secondary" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <SearchX />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Pagination({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  const count = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="pagination">
      <span>
        {total} results · Page {page} of {count}
      </span>
      <div className="flex gap-2">
        <IconButton label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ArrowLeft size={17} />
        </IconButton>
        <IconButton label="Next page" disabled={page >= count} onClick={() => onPage(page + 1)}>
          <ArrowRight size={17} />
        </IconButton>
      </div>
    </div>
  );
}
