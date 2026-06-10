import { useState } from 'react';
import { Subscription, FxRates } from '../../../src/shared/types';
import { getLogoUrls, getInitials, getAvatarColor } from '../utils/logo';
import { formatNative, formatSubscriptionAmount } from '../utils/currency';

interface Props {
  sub: Subscription;
  onEdit: (sub: Subscription) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPay?: (id: string) => Promise<void>;
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

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

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

export function SubscriptionCard({ sub, onEdit, onDelete, onArchive, onRestore, onPay, selectable, selected, onSelect, fxRates, isRemoving, justSaved }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [paying, setPaying] = useState(false);

  const days = daysUntil(sub.nextBillingDate);
  const urgencyText = days <= 3 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-gray-400';
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
    <article className={`bg-white rounded-2xl border shadow-sm hover:shadow-md overflow-hidden
      transition-all duration-200 ease-out
      ${isRemoving ? 'opacity-0 scale-[0.97] pointer-events-none' : ''}
      ${justSaved  ? 'ring-2 ring-green-400 border-green-300' : selected ? 'border-indigo-400 ring-2 ring-indigo-200' : urgencyBorder}
      ${!sub.isActive ? 'opacity-60' : ''}
    `}>
      <div className="p-5">
        <div className="flex items-start gap-3">
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

          <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 truncate">{sub.name}</h3>
                {!sub.isActive && (
                  <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    Paused
                  </span>
                )}
              </div>
              {sub.service && (
                <p className="text-xs text-gray-500 truncate mt-0.5">{sub.service}</p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {sub.category && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catColor}`}>
                    {sub.category}
                  </span>
                )}
                {sub.website && (
                  // Linkify only if it looks like a URL/domain; otherwise show the
                  // reference (tag, address, note) as plain text.
                  (/^https?:\/\//i.test(sub.website) || (/\.[a-z]{2,}/i.test(sub.website) && !/\s/.test(sub.website))) ? (
                    <a
                      href={/^https?:\/\//i.test(sub.website) ? sub.website : `https://${sub.website}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-indigo-600 hover:underline truncate max-w-[160px]"
                    >
                      {sub.website.replace(/^https?:\/\//i, '')}
                    </a>
                  ) : (
                    <span className="text-xs text-gray-500 truncate max-w-[160px]">{sub.website}</span>
                  )
                )}
                {sub.isActive && (
                  <span className={`text-xs font-medium ${urgencyText}`}>
                    {days === 0 ? 'Due today' : days < 0 ? `${Math.abs(days)}d overdue` : `Due in ${days}d`}
                  </span>
                )}
                {sub.isActive && sub.autopay && (
                  <span
                    className="shrink-0 inline-flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700"
                    title={sub.autopayMaxAmount != null
                      ? `Auto-paid from wallet (up to ${sub.currency} ${sub.autopayMaxAmount})`
                      : 'Auto-paid from wallet on the billing date'}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Auto
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-gray-900">{amountPrimary}</p>
              <p className="text-xs text-gray-400">/{CYCLE_LABEL[sub.billingCycle]}</p>
              {showMonthlyEquiv && (
                <p className="text-xs text-gray-400 mt-0.5">
                  ≈ {formatNative(monthlyEquiv, sub.currency)}/mo
                </p>
              )}
              {amountNgn && (
                <p className="text-xs text-emerald-600 mt-0.5">{amountNgn}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {new Date(sub.nextBillingDate).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </span>
            {sub.notes && (
              <button
                onClick={() => setExpanded(prev => !prev)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-0.5"
                aria-label={expanded ? 'Hide notes' : 'Show notes'}
                aria-expanded={expanded}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Notes
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {sub.isActive ? (
              <>
                {onPay && days <= 0 && (
                  <button
                    onClick={async () => {
                      setPaying(true);
                      try { await onPay(sub.id); } finally { setPaying(false); }
                    }}
                    disabled={paying}
                    className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold transition-colors disabled:opacity-50"
                    aria-label={`Pay ${sub.name} from wallet`}
                  >
                    {paying ? '…' : 'Pay now'}
                  </button>
                )}
                <button
                  onClick={() => onEdit(sub)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                  aria-label={`Edit ${sub.name}`}
                >
                  Edit
                </button>
                {onArchive && (
                  <button
                    onClick={() => onArchive(sub.id)}
                    className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
                    aria-label={`Pause ${sub.name}`}
                    title="Pause stops reminders & autopay and excludes it from spend totals — but keeps the record and history. Resume anytime."
                  >
                    Pause
                  </button>
                )}
                <button
                  onClick={() => onDelete(sub.id)}
                  className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                  aria-label={`Delete ${sub.name}`}
                >
                  Delete
                </button>
              </>
            ) : (
              <>
                {onRestore && (
                  <button
                    onClick={() => onRestore(sub.id)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                    aria-label={`Restore ${sub.name}`}
                  >
                    Restore
                  </button>
                )}
                <button
                  onClick={() => onDelete(sub.id)}
                  className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                  aria-label={`Delete ${sub.name}`}
                >
                  Delete
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
