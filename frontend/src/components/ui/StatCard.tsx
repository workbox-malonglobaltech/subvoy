import { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Sparkline } from './Sparkline';

interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Month-over-month delta %; positive = up (red, more spend), negative = down (green). */
  trend?: number | null;
  /** Inverts trend colour semantics (e.g. for metrics where up is good). */
  trendUpIsGood?: boolean;
  /** Icon shown in a soft-tinted chip (top-left), Admin-dashboard style. */
  icon?: ReactNode;
  /** Override chip colour, e.g. 'bg-info-50 text-info-600'. Defaults to primary. */
  iconClassName?: string;
  /** Optional trend series rendered as a sparkline at the bottom. */
  sparkline?: number[];
  hint?: string;
  className?: string;
}

/** Executive KPI card — icon chip + corner trend badge + label + value + sparkline. */
export function StatCard({ label, value, trend, trendUpIsGood, icon, iconClassName, sparkline, hint, className }: StatCardProps) {
  const up = (trend ?? 0) > 0;
  const good = trendUpIsGood ? up : !up;
  return (
    <div className={cn('flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card', className)}>
      {(icon || trend != null) && (
        <div className="mb-3 flex items-center justify-between">
          {icon ? (
            <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', iconClassName ?? 'bg-primary-50 text-primary-600')}>{icon}</span>
          ) : <span />}
          {trend != null && (
            <span className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
              good ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-600',
            )}>
              <span aria-hidden="true">{up ? '↑' : '↓'}</span>{Math.abs(trend).toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <p className="text-eyebrow uppercase text-fg-subtle">{label}</p>
      <div className="mt-1.5 text-2xl font-bold leading-tight text-fg tabular-nums">{value}</div>
      {hint && <p className="mt-1 text-caption text-fg-subtle">{hint}</p>}
      {sparkline && sparkline.length > 1 && (
        <div className="mt-auto pt-3 text-primary"><Sparkline data={sparkline} /></div>
      )}
    </div>
  );
}
