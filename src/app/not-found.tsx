import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>Page not found</h1>
      <p>This address is not part of the workspace.</p>
      <Link className="button primary" href="/studio">
        Return to studio
      </Link>
    </div>
  );
}
