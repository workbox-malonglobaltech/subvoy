import type { BillingUsageItem } from '../../../src/shared/types';

interface PlanUsageMeterProps {
  usage: BillingUsageItem[] | null;
  limitKey: string;
  /** Plural noun for the items, e.g. "tracked items". */
  label: string;
  onUpgrade: () => void;
}

/** Compact usage bar — "7 of 10 tracked items" with an upgrade nudge as the
 *  workspace nears (≥80%) or hits its plan cap. Hidden when unlimited/unknown. */
export function PlanUsageMeter({ usage, limitKey, label, onUpgrade }: PlanUsageMeterProps) {
  const item = usage?.find(u => u.key === limitKey);
  if (!item || item.limit < 0) return null; // unlimited (-1) or not loaded → no meter

  const pct = item.limit > 0 ? Math.min(100, Math.round((item.used / item.limit) * 100)) : 0;
  const near = item.used >= item.limit * 0.8;
  const atCap = item.used >= item.limit;
  const fill = atCap ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-primary';

  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-fg-muted">
          <span className="font-semibold text-fg">{item.used}</span> of {item.limit} {label}
        </span>
        {(near || atCap) && (
          <button onClick={onUpgrade} className="font-semibold text-primary hover:underline shrink-0">
            {atCap ? 'Upgrade to add more' : 'Upgrade'}
          </button>
        )}
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div className={`h-full rounded-full transition-all ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
