import { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Month-over-month delta %; positive = up (red, more spend), negative = down (green). */
  trend?: number | null;
  /** Inverts trend colour semantics (e.g. for metrics where up is good). */
  trendUpIsGood?: boolean;
  hint?: string;
  className?: string;
}

/** Executive KPI card — label, large value, optional trend delta. */
export function StatCard({ label, value, trend, trendUpIsGood, hint, className }: StatCardProps) {
  const up = (trend ?? 0) > 0;
  const good = trendUpIsGood ? up : !up;
  return (
    <div className={cn('rounded-2xl border border-line bg-surface p-5 shadow-card', className)}>
      <p className="text-eyebrow uppercase text-fg-subtle">{label}</p>
      <div className="mt-2 text-2xl font-bold leading-tight text-fg space-y-0.5 tabular-nums">{value}</div>
      {hint && <p className="mt-1 text-caption text-fg-subtle">{hint}</p>}
      {trend != null && (
        <p className={cn('mt-1 flex items-center gap-0.5 text-caption font-medium', good ? 'text-success-700' : 'text-error-600')}>
          <span aria-hidden="true">{up ? '↑' : '↓'}</span>
          {Math.abs(trend).toFixed(0)}% vs last month
        </p>
      )}
    </div>
  );
}
