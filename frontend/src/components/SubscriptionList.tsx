import { Subscription, FxRates } from '../../../src/shared/types';
import { daysUntil } from '../lib/date';
import { formatSubscriptionAmount } from '../utils/currency';
import { Badge } from './ui/Badge';

const CYCLE: Record<string, string> = { weekly: 'wk', monthly: 'mo', yearly: 'yr' };

interface Props {
  subs: Subscription[];
  onEdit: (s: Subscription) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  onMarkPaid?: (id: string) => void;
  fxRates?: FxRates | null;
}

const EDIT = 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z';
const PAUSE = 'M9.5 8v8M14.5 8v8';
const TRASH = 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16';
const RESTORE = 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15';

function Icon({ d }: { d: string }) {
  return <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} /></svg>;
}

/** Compact table-style list of subscriptions (the dashboard "list" view). */
const CHECK = 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';

export function SubscriptionList({ subs, onEdit, onDelete, onArchive, onRestore, onMarkPaid, fxRates }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <ul className="divide-y divide-line">
        {subs.map(sub => {
          const days = daysUntil(sub.nextBillingDate);
          const { primary } = formatSubscriptionAmount(sub.amount, sub.currency, fxRates ?? null);
          const due = days === 0 ? 'Due today' : days < 0 ? `${Math.abs(days)}d overdue` : `Due in ${days}d`;
          const dueColor = days <= 3 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-fg-subtle';
          return (
            <li key={sub.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted/60">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-fg">{sub.name}</span>
                  {!sub.isActive && <Badge tone="neutral" className="shrink-0">Paused</Badge>}
                </div>
                {sub.category && <span className="text-xs text-fg-subtle">{sub.category}</span>}
              </div>
              <span className="hidden sm:block w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-fg">
                {primary}<span className="text-xs font-normal text-fg-subtle"> /{CYCLE[sub.billingCycle]}</span>
              </span>
              <span className={`hidden md:block w-24 shrink-0 text-right text-xs font-medium ${sub.isActive ? dueColor : 'text-fg-subtle'}`}>
                {sub.isActive ? due : '—'}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                {sub.isActive && onMarkPaid && (
                  <button onClick={() => onMarkPaid(sub.id)} aria-label={`Mark ${sub.name} paid`} title="Mark as paid — advances to next cycle (no charge)"
                    className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-emerald-50 hover:text-emerald-600"><Icon d={CHECK} /></button>
                )}
                <button onClick={() => onEdit(sub)} aria-label={`Edit ${sub.name}`} title="Edit"
                  className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"><Icon d={EDIT} /></button>
                {sub.isActive && onArchive && (
                  <button onClick={() => onArchive(sub.id)} aria-label={`Pause ${sub.name}`} title="Pause"
                    className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"><Icon d={PAUSE} /></button>
                )}
                {!sub.isActive && onRestore && (
                  <button onClick={() => onRestore(sub.id)} aria-label={`Restore ${sub.name}`} title="Restore"
                    className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"><Icon d={RESTORE} /></button>
                )}
                <button onClick={() => onDelete(sub.id)} aria-label={`Delete ${sub.name}`} title="Delete"
                  className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-error-50 hover:text-error-600"><Icon d={TRASH} /></button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
