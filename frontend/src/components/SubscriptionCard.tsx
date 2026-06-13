import { memo, useState } from 'react';
import { Subscription, FxRates } from '../../../src/shared/types';
import { daysUntil } from '../lib/date';
import { getLogoUrls, getInitials, getAvatarColor } from '../utils/logo';
import { formatNative, formatSubscriptionAmount } from '../utils/currency';
import { Badge } from './ui/Badge';

interface Props {
  sub: Subscription;
  onEdit: (sub: Subscription) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPay?: (id: string) => Promise<void>;
  /** Record an external payment → advance the cycle (non-custodial, no charge). */
  onMarkPaid?: (id: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  fxRates?: FxRates | null;
  /** Triggers a fade-out + scale-down when the card is about to be removed */
  isRemoving?: boolean;
  /** Briefly highlights the card with a green ring after a successful save */
  justSaved?: boolean;
}

const CYCLE_LABEL: Record<string, string> = { weekly: 'wk', monthly: 'mo', yearly: 'yr' };
const CYCLE_FULL:  Record<string, string> = { weekly: 'week', monthly: 'month', yearly: 'year' };

const CATEGORY_COLORS: Record<string, string> = {
  'Entertainment':  'bg-purple-100 text-purple-700',
  'Software & SaaS':'bg-blue-100 text-blue-700',
  'Utilities':      'bg-yellow-100 text-yellow-700',
  'Health & Fitness':'bg-green-100 text-green-700',
  'Food & Drink':   'bg-orange-100 text-orange-700',
  'Education':      'bg-sky-100 text-sky-700',
  'Finance':        'bg-emerald-100 text-emerald-700',
  'Shopping':       'bg-pink-100 text-pink-700',
  'Music':          'bg-rose-100 text-rose-700',
  'Gaming':         'bg-violet-100 text-violet-700',
  'Other':          'bg-gray-100 text-gray-600',
};

function normalizeToMonthly(amount: number, cycle: string): number {
  if (cycle === 'yearly')  return amount / 12;
  if (cycle === 'weekly')  return amount * 52 / 12;
  return amount;
}

function ServiceLogo({ name }: { name: string }) {
  const urls = getLogoUrls(name);
  const [urlIndex, setUrlIndex] = useState(0);
  const initials = getInitials(name);
  const avatarColor = getAvatarColor(name);

  if (urlIndex >= urls.length) {
    return (
      <div className={`w-10 h-10 rounded-xl ${avatarColor} flex items-center justify-center shrink-0`}>
        <span className="text-white text-sm font-bold">{initials}</span>
      </div>
    );
  }

  return (
    <img
      src={urls[urlIndex]}
      alt={`${name} logo`}
      className="w-10 h-10 rounded-xl object-contain bg-white border border-gray-100 p-1 shrink-0"
      onError={() => setUrlIndex(i => i + 1)}
    />
  );
}

function SubscriptionCardImpl({ sub, onEdit, onDelete, onArchive, onRestore, onPay, onMarkPaid, selectable, selected, onSelect, fxRates, isRemoving, justSaved }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [paying, setPaying] = useState(false);

  const days = daysUntil(sub.nextBillingDate);
  const urgencyText = days <= 3 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-fg-subtle';
  const catColor = CATEGORY_COLORS[sub.category ?? ''] ?? 'bg-indigo-50 text-indigo-600';

  // Left-accent border by urgency (only when active and not selected)
  const urgencyBorder = !sub.isActive
    ? 'border-gray-200'
    : days < 0
    ? 'border-l-4 border-l-red-500 border-gray-200'
    : days <= 3
    ? 'border-l-4 border-l-red-400 border-gray-200'
    : days <= 7
    ? 'border-l-4 border-l-amber-400 border-gray-200'
    : 'border-gray-200';
  const monthlyEquiv = normalizeToMonthly(sub.amount, sub.billingCycle);
  const showMonthlyEquiv = sub.billingCycle !== 'monthly';
  const { primary: amountPrimary, secondary: amountNgn } = formatSubscriptionAmount(
    sub.amount, sub.currency, fxRates ?? null
  );

  return (
    <article className={`bg-surface rounded-2xl border shadow-card hover:shadow-pop hover:-translate-y-0.5 overflow-hidden
      transition-all duration-200 ease-out
      ${isRemoving ? 'opacity-0 scale-[0.97] pointer-events-none' : ''}
      ${justSaved  ? 'ring-2 ring-green-400 border-green-300' : selected ? 'border-indigo-400 ring-2 ring-indigo-200' : urgencyBorder}
      ${!sub.isActive ? 'opacity-60' : ''}
    `}>
      <div className="p-4">
        <div className="flex items-start gap-2.5">
          {selectable && (
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={e => onSelect?.(sub.id, e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
              aria-label={`Select ${sub.name}`}
            />
          )}
          <ServiceLogo name={sub.name} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold text-fg">{sub.name}</h3>
              {!sub.isActive && <Badge tone="neutral" className="shrink-0">Paused</Badge>}
            </div>
            {sub.category && (
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${catColor}`}>{sub.category}</span>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="mt-3">
          <p className="text-lg font-bold leading-none text-fg">
            {amountPrimary}<span className="text-xs font-medium text-fg-subtle"> /{CYCLE_LABEL[sub.billingCycle]}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {showMonthlyEquiv && <span className="text-fg-subtle">≈ {formatNative(monthlyEquiv, sub.currency)}/mo</span>}
            {amountNgn && <span className="text-emerald-600">{amountNgn}</span>}
          </div>
        </div>

        {/* Due + autopay */}
        {sub.isActive && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`text-xs font-medium ${urgencyText}`}>
              {days === 0 ? 'Due today' : days < 0 ? `${Math.abs(days)}d overdue` : `Due in ${days}d`}
            </span>
            {sub.autopay && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700"
                title={sub.autopayMaxAmount != null
                  ? `Auto-paid from wallet (up to ${sub.currency} ${sub.autopayMaxAmount})`
                  : 'Auto-paid from wallet on the billing date'}>
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Auto
              </span>
            )}
            {onMarkPaid && days <= 0 && (
              <button
                onClick={() => onMarkPaid(sub.id)}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                title="Records a payment you made elsewhere — advances to the next cycle (no charge)"
              >
                Mark paid →
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-line gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-fg-subtle">
              {new Date(sub.nextBillingDate).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </span>
            {sub.notes && (
              <button
                onClick={() => setExpanded(prev => !prev)}
                className="rounded-lg p-1 text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
                aria-label={expanded ? 'Hide notes' : 'Show notes'}
                aria-expanded={expanded}
                title="Notes"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {sub.isActive ? (
              <>
                {onPay && days <= 0 && (
                  <button
                    onClick={async () => { setPaying(true); try { await onPay(sub.id); } finally { setPaying(false); } }}
                    disabled={paying}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                    aria-label={`Pay ${sub.name} from wallet`}
                  >
                    {paying ? '…' : 'Pay now'}
                  </button>
                )}
                {onMarkPaid && days > 0 && (
                  <button onClick={() => onMarkPaid(sub.id)} aria-label={`Mark ${sub.name} paid`} title="Mark as paid — advances to next cycle (no charge)"
                    className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-emerald-50 hover:text-emerald-600">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                )}
                <button onClick={() => onEdit(sub)} aria-label={`Edit ${sub.name}`} title="Edit"
                  className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                {onArchive && (
                  <button onClick={() => onArchive(sub.id)} aria-label={`Pause ${sub.name}`}
                    title="Pause stops reminders & autopay and excludes it from spend totals — but keeps the record and history. Resume anytime."
                    className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.5 8v8M14.5 8v8" /></svg>
                  </button>
                )}
                <button onClick={() => onDelete(sub.id)} aria-label={`Delete ${sub.name}`} title="Delete"
                  className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-error-50 hover:text-error-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </>
            ) : (
              <>
                {onRestore && (
                  <button onClick={() => onRestore(sub.id)} aria-label={`Restore ${sub.name}`} title="Restore"
                    className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                )}
                <button onClick={() => onDelete(sub.id)} aria-label={`Delete ${sub.name}`} title="Delete"
                  className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-error-50 hover:text-error-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expandable notes panel */}
      {expanded && sub.notes && (
        <div className="px-5 pb-4 border-t border-gray-50 bg-gray-50 rounded-b-2xl">
          <div className="pt-3 space-y-2">
            <div className="flex gap-4 text-xs text-gray-500">
              <span>Billing every {CYCLE_FULL[sub.billingCycle]}</span>
              <span>·</span>
              <span>{sub.currency}</span>
              {showMonthlyEquiv && (
                <>
                  <span>·</span>
                  <span>{formatNative(monthlyEquiv, sub.currency)}/mo equiv.</span>
                </>
              )}
            </div>
            <p className="text-xs text-gray-600 whitespace-pre-wrap">{sub.notes}</p>
          </div>
        </div>
      )}
    </article>
  );
}

/**
 * Memoized — with the dashboard now passing stable callbacks (useCallback) and a
 * stable `sub`, cards skip re-render on unrelated dashboard state changes
 * (e.g. typing in search), instead of re-rendering the whole list each keystroke.
 */
export const SubscriptionCard = memo(SubscriptionCardImpl);
