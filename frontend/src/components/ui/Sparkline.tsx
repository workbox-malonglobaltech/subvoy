import { cn } from '../../lib/cn';

interface Props {
  /** Series of values; the line is drawn min→max normalised. */
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

/** Minimal trend line (no axes) for KPI cards. Inherits colour via currentColor. */
export function Sparkline({ data, width = 120, height = 30, className }: Props) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = pts.join(' ');
  const area = `0,${height} ${line} ${width},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
      className={cn('h-7 w-full', className)} aria-hidden="true">
      <polygon points={area} className="fill-current opacity-10" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
