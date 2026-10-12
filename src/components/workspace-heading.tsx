import type { ReactNode } from 'react';

export function WorkspaceHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const split = title.lastIndexOf(' ');
  return (
    <div className="page-heading continuum-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>
          {split < 0 ? '' : title.slice(0, split + 1)}
          <span className="workspace-title-word">{title.slice(split + 1)}</span>
          <span className="heading-dot">.</span>
        </h1>
        <p>{description}</p>
      </div>
      {children && <div className="workspace-heading-actions">{children}</div>}
    </div>
  );
}
