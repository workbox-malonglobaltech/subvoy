import { cn } from '../../lib/cn';

interface Props {
  /** 0–100+ (values >100 clamp the arc but the label still reads the real %). */
  pct: number;
  size?: number;
  stroke?: number;
  /** Override the arc colour; defaults to success/warning/error by threshold. */
  className?: string;
  label?: string;
}

/** Compact circular progress indicator with a centered % label. */
export function ProgressRing({ pct, size = 46, stroke = 4, className, label }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(pct, 0), 100);
  const offset = c - (clamped / 100) * c;
  const arc = className ?? (pct >= 100 ? 'text-error-500' : pct >= 75 ? 'text-warning-500' : 'text-success-500');
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="currentColor" className="text-surface-muted" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="currentColor"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          className={cn('transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none', arc)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-fg">
        {label ?? `${Math.round(pct)}%`}
      </span>
    </div>
  );
}
