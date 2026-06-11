import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatNative } from '../utils/currency';

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16',
];

interface Props {
  byCategory: { category: string; total: number }[];
  /** Currency to format the (native) category totals in. */
  currency: string;
}

/** Dashboard sidebar panel: spend-by-category donut + legend. */
export function SpendByCategoryCard({ byCategory, currency }: Props) {
  return (
    <div className="bg-surface rounded-2xl border border-line p-5 shadow-card">
      <h2 className="text-sm font-semibold text-fg-muted mb-4">Spend by category</h2>
      {byCategory.length === 0 ? (
        <p className="text-sm text-fg-subtle text-center py-6">No data yet</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={byCategory} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => formatNative(Number(v), currency)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {byCategory.map((c, i) => (
              <div key={c.category} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />
                  <span className="text-fg-muted truncate max-w-[120px]">{c.category}</span>
                </div>
                <span className="font-medium text-fg">{formatNative(c.total, currency)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
