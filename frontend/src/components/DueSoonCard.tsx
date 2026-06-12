import { Subscription, FxRates } from '../../../src/shared/types';
import { daysUntil } from '../lib/date';
import { formatNative, convertAmount } from '../utils/currency';

interface Props {
  /** Upcoming subscriptions (already filtered/sorted by the dashboard). */
  upcoming: Subscription[];
  fxRates: FxRates | null;
  /** Omitted when wallet payments are disabled — hides the "Pay now" action. */
  onPay?: (id: string) => void;
}

/** Dashboard sidebar panel: next 5 due subscriptions with a quick "Pay now". */
export function DueSoonCard({ upcoming, fxRates, onPay }: Props) {
  const items = upcoming.slice(0, 5);
  return (
    <div className="bg-surface rounded-2xl border border-line p-5 shadow-card">
      <h2 className="text-sm font-semibold text-fg-muted mb-3">Due soon</h2>
      {items.length === 0 ? (
        <p className="text-sm text-fg-subtle">Nothing due in the next 30 days</p>
      ) : (
        <ul className="space-y-3">
          {items.map(sub => {
            const days = daysUntil(sub.nextBillingDate);
            const ngnEquiv = fxRates && sub.currency !== 'NGN'
              ? convertAmount(sub.amount, sub.currency, 'NGN', fxRates)
              : null;
            return (
              <li key={sub.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg truncate max-w-[120px]">{sub.name}</p>
                  <p className={`text-xs font-medium ${
                    days < 0 ? 'text-red-600' : days === 0 ? 'text-red-500' : days <= 3 ? 'text-amber-600' : 'text-fg-subtle'
                  }`}>
                    {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `In ${days}d`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-fg">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: sub.currency }).format(sub.amount)}
                  </p>
                  {ngnEquiv !== null && <p className="text-xs text-emerald-600">{formatNative(ngnEquiv, 'NGN')}</p>}
                  {onPay && days <= 0 && (
                    <button onClick={() => onPay(sub.id)}
                      className="text-xs text-primary hover:text-primary-700 font-semibold transition-colors mt-0.5">
                      Pay now →
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
