import { FxRates } from '../../../src/shared/types';
import { formatNative } from '../utils/currency';

interface Props {
  fxRates: FxRates;
  /** Currencies the user uses — non-USD ones get a "$1 = …" row. */
  currencies: string[];
  stale: boolean;
}

/** Dashboard rail card: USD → local exchange rates (mid-market). */
export function ExchangeRatesCard({ fxRates, currencies, stale }: Props) {
  const rows = currencies.filter(c => c !== 'USD');
  const list = rows.length ? rows : ['NGN'];
  return (
    <div className="bg-surface rounded-2xl border border-line p-5 shadow-card">
      <h2 className="mb-3 text-sm font-semibold text-fg-muted">Exchange rates</h2>
      <ul className="space-y-2 text-sm">
        {list.map(cur => {
          const rate = fxRates.rates[`USD_${cur}`];
          return (
            <li key={cur} className="flex items-center justify-between">
              <span className="text-fg-muted">$1.00</span>
              <span className="font-semibold tabular-nums text-fg">= {rate ? formatNative(rate, cur) : '—'}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[10px] text-fg-subtle">
        {stale
          ? '⚠ May be outdated — refreshed daily'
          : `As of ${new Date(fxRates.fetchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · mid-market`}
      </p>
    </div>
  );
}
