import { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optional CTA(s) — e.g. a <Button> or <Link>. */
  action?: ReactNode;
  className?: string;
}

/** Generic, design-system empty state: icon + title + body + optional CTA. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-14 px-6', className)}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-fg-subtle">
          {icon}
        </div>
      )}
      <h3 className="text-h4 text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-body text-fg-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
