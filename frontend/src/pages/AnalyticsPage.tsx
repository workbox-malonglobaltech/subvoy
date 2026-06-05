import { useAnalytics } from '../hooks/useAnalytics';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { useSummary } from '../hooks/useSummary';
import { NavBar } from '../components/NavBar';
import { MonthlyChart } from '../components/MonthlyChart';
import { CalendarView } from '../components/CalendarView';
import { StatCardSkeleton, ChartSkeleton, Skeleton } from '../components/Skeleton';

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16',
];

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function AnalyticsPage() {
  const { data, loading, error } = useAnalytics();
  const { subscriptions } = useSubscriptions();
  const { summary } = useSummary([subscriptions.length]);

  const currentYear = new Date().getFullYear().toString();
  const ytdSpend = data
    ? data.months
        .filter(m => m.month.startsWith(currentYear))
        .reduce((acc, m) => acc + m.total, 0)
    : 0;

  const maxCategory = summary?.byCategory.reduce((a, b) => (a.total > b.total ? a : b), { category: '', total: 0 });

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar actions={
        <a
          href="/analytics/export"
          download
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 sm:px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="hidden sm:inline">Export CSV</span>
        </a>
      } />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-page-enter">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

        {/* Top stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            <><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">YTD Spend</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(ytdSpend)}</p>
                <p className="text-xs text-gray-400 mt-1">{currentYear} so far</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Monthly avg</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {!data ? '—' : formatCurrency(
                    data.months.filter(m => m.total > 0).length > 0
                      ? data.months.reduce((a, m) => a + m.total, 0) / data.months.filter(m => m.total > 0).length
                      : 0
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-1">Across active months</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Top category</p>
                <p className="mt-2 text-2xl font-bold text-gray-900 truncate">
                  {maxCategory?.category || '—'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {maxCategory?.total ? formatCurrency(maxCategory.total) + '/mo' : 'No data yet'}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly bar chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Monthly Spend</h2>
            <p className="text-xs text-gray-400 mb-5">Last 12 months · current month highlighted</p>
            {error ? (
              <p className="text-sm text-red-500 py-8 text-center">{error}</p>
            ) : loading ? (
              <ChartSkeleton height={240} />
            ) : (
              <MonthlyChart months={data?.months ?? []} />
            )}
          </div>

          {/* Category breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">By Category</h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                    <Skeleton className="h-1.5 rounded-full" style={{ width: `${70 - i * 15}%` }} />
                  </div>
                ))}
              </div>
            ) : !summary || summary.byCategory.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>
            ) : (
              <div className="space-y-3">
                {summary.byCategory.map((cat, i) => {
                  const maxTotal = summary.byCategory[0].total;
                  const pct = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0;
                  return (
                    <div key={cat.category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-700 font-medium truncate max-w-[120px]">{cat.category}</span>
                        <span className="text-gray-500">{formatCurrency(cat.total)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Calendar view */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Upcoming Payments</h2>
          <p className="text-xs text-gray-400 mb-5">Based on next billing dates</p>
          <CalendarView subscriptions={subscriptions} />
        </div>
      </main>
    </div>
  );
}
