import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatNative } from '../utils/currency';

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16',
];

interface Props {
  byCategory: { category: string; currency: string; total: number }[];
  /** The currency to show the breakdown for (no cross-currency mixing). */
  currency: string;
  /** Click a slice/legend row to filter the list to that category. */
  onSelectCategory?: (category: string) => void;
  /** Currently-filtered category, for highlight. */
  activeCategory?: string;
}

/** Dashboard sidebar panel: spend-by-category donut + legend, with a currency toggle. */
export function SpendByCategoryCard({ byCategory, currency, onSelectCategory, activeCategory }: Props) {
  const available = Array.from(new Set(byCategory.map(c => c.currency)));
  const [picked, setPicked] = useState(currency);
  // Show one currency at a time — summing across currencies would let a
  // high-magnitude currency (e.g. NGN) swamp the chart.
  const cur = available.includes(picked) ? picked : (available[0] ?? currency);
  const rows = byCategory.filter(c => c.currency === cur);
  return (
    <div className="bg-surface rounded-2xl border border-line p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg-muted">Spend by category</h2>
        {available.length > 1 && (
          <div className="flex rounded-lg border border-line p-0.5">
            {available.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setPicked(c)}
                aria-pressed={cur === c}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  cur === c ? 'bg-surface-muted text-fg' : 'text-fg-subtle hover:text-fg'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-fg-subtle text-center py-6">No data yet</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={rows} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}
                onClick={(_, index: number) => { const cat = rows[index]?.category; if (cat) onSelectCategory?.(cat); }}
                className={onSelectCategory ? 'cursor-pointer' : undefined}
              >
                {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => formatNative(Number(v), cur)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-3">
            {rows.map((c, i) => {
              const active = activeCategory === c.category;
              return (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => onSelectCategory?.(c.category)}
                  aria-pressed={active}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-sm transition-colors ${
                    active ? 'bg-primary-50' : 'hover:bg-surface-muted'
                  } ${onSelectCategory ? '' : 'pointer-events-none'}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />
                    <span className={`truncate ${active ? 'font-medium text-primary-700' : 'text-fg-muted'}`}>{c.category}</span>
                  </span>
                  <span className="font-medium tabular-nums text-fg shrink-0">{formatNative(c.total, cur)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
