import { useState, useMemo, useCallback } from 'react';
import { usePaymentHistory, PaymentRecord } from '../hooks/usePaymentHistory';
import { TransactionRowSkeleton } from '../components/Skeleton';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

// ── Date range helpers ────────────────────────────────────────────────────────

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Preset = 'this_month' | 'last_3' | 'last_6' | 'last_12' | 'all';

function presetRange(p: Preset): { from?: string; to?: string; label: string } {
  const now   = new Date();
  const today = toIso(now);

  switch (p) {
    case 'this_month': {
      const from = toIso(new Date(now.getFullYear(), now.getMonth(), 1));
      return { from, to: today, label: 'This month' };
    }
    case 'last_3': {
      const from = toIso(new Date(now.getFullYear(), now.getMonth() - 2, 1));
      return { from, to: today, label: 'Last 3 months' };
    }
    case 'last_6': {
      const from = toIso(new Date(now.getFullYear(), now.getMonth() - 5, 1));
      return { from, to: today, label: 'Last 6 months' };
    }
    case 'last_12': {
      const from = toIso(new Date(now.getFullYear(), now.getMonth() - 11, 1));
      return { from, to: today, label: 'Last 12 months' };
    }
    default:
      return { label: 'All time' };
  }
}

// ── Currency formatting ───────────────────────────────────────────────────────

function fmtAmount(amount: number, currency: string): string {
  if (currency === 'NGN') return `₦${amount.toLocaleString('en-NG')}`;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCsv(payments: PaymentRecord[], periodLabel: string) {
  const headers = ['Date', 'Subscription', 'Currency', 'Amount', 'Balance After'];
  const rows = payments.map(p => [
    new Date(p.paidAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    `"${p.description.replace(/^Paid:\s*/i, '').replace(/"/g, '""')}"`,
    p.currency,
    p.amount.toFixed(2),
    p.balanceAfter.toFixed(2),
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `subvoy-payments-${periodLabel.replace(/\s+/g, '-').toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Summary stat card ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900 truncate">{value}</p>
      {sub && <p className="mt-1 text-xs text-fg-subtle">{sub}</p>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const { user } = useAuth();
  const toast    = useToast();

  // ── Date range state ──────────────────────────────────────────────────────
  const [preset, setPreset]     = useState<Preset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');

  const range = useMemo(() => {
    if (preset === 'all') return presetRange('all');
    return presetRange(preset);
  }, [preset]);

  const activeFrom = preset === 'all' ? customFrom || undefined
                   : range.from;
  const activeTo   = preset === 'all' ? customTo   || undefined
                   : range.to;

  // ── Data ──────────────────────────────────────────────────────────────────
  const { payments, loading, error } = usePaymentHistory(activeFrom, activeTo);

  // ── Search / filter ───────────────────────────────────────────────────────
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!payments) return [];
    if (!search.trim()) return payments;
    const q = search.toLowerCase();
    return payments.filter(p =>
      p.description.toLowerCase().includes(q) ||
      p.currency.toLowerCase().includes(q)
    );
  }, [payments, search]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!filtered.length) return null;

    // Totals per currency
    const byCurrency = filtered.reduce<Record<string, number>>((acc, p) => {
      acc[p.currency] = (acc[p.currency] ?? 0) + p.amount;
      return acc;
    }, {});

    // Top subscription (by total spend across all currencies normalised to count)
    const byName = filtered.reduce<Record<string, number>>((acc, p) => {
      const name = p.description.replace(/^Paid:\s*/i, '');
      acc[name] = (acc[name] ?? 0) + 1;
      return acc;
    }, {});
    const topName = Object.entries(byName).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    return { byCurrency, topName, count: filtered.length };
  }, [filtered]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const [emailing, setEmailing] = useState(false);

  const handleEmail = useCallback(async () => {
    if (!filtered.length) return;
    setEmailing(true);
    try {
      await api.post('/reports/email', {
        from:     activeFrom,
        to:       activeTo,
        payments: filtered.map(p => ({
          id:          p.id,
          description: p.description,
          currency:    p.currency,
          amount:      p.amount,
          paidAt:      p.paidAt,
        })),
      });
      toast.success(`Report sent to ${user?.email}`);
    } catch (e) {
      toast.error('Failed to send report email');
    } finally {
      setEmailing(false);
    }
  }, [payments, filtered, activeFrom, activeTo, user, toast]);

  const handlePrint = () => window.print();

  const periodLabel = preset === 'all'
    ? (activeFrom && activeTo ? `${activeFrom} to ${activeTo}` : 'All time')
    : range.label;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-page-enter">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Payment history from your Subvoy wallet — filter, export, or email.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              onClick={() => exportCsv(filtered, periodLabel)}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              title="Download CSV"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV
            </button>

            <button
              onClick={handlePrint}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              title="Print / Save as PDF"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              PDF
            </button>

            <button
              onClick={handleEmail}
              disabled={emailing || filtered.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              title={`Email report to ${user?.email}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {emailing ? 'Sending…' : 'Email report'}
            </button>
          </div>
        </div>

        {/* ── Date range presets ────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            {(['this_month', 'last_3', 'last_6', 'last_12', 'all'] as Preset[]).map(p => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  preset === p
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {presetRange(p).label}
              </button>
            ))}
          </div>

          {/* Custom date range — shown only when "All time" is selected as custom */}
          {preset === 'all' && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 shrink-0">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 shrink-0">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Summary cards ────────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(stats.byCurrency).map(([cur, total]) => (
              <StatCard
                key={cur}
                label={`Total spent (${cur})`}
                value={fmtAmount(total, cur)}
                sub={`${stats.count} payment${stats.count !== 1 ? 's' : ''}`}
              />
            ))}
            <StatCard
              label="Most paid"
              value={stats.topName}
              sub="by number of payments"
            />
          </div>
        )}

        {/* ── Search ───────────────────────────────────────────────────────── */}
        <div className="relative print:hidden">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search subscriptions…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
        </div>

        {/* ── Payments table ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Table header */}
          <div className="border-b border-gray-100 px-6 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Payment History
              {filtered.length > 0 && (
                <span className="ml-2 text-xs font-medium text-fg-subtle">
                  {filtered.length} record{filtered.length !== 1 ? 's' : ''}
                </span>
              )}
            </h2>
            <p className="text-xs text-fg-subtle">{periodLabel}</p>
          </div>

          {/* Loading */}
          {loading && (
            <ul>
              {Array.from({ length: 5 }).map((_, i) => (
                <TransactionRowSkeleton key={i} />
              ))}
            </ul>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filtered.length === 0 && (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-7 w-7 text-fg-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-700">No payments recorded</p>
              <p className="mt-1 text-xs text-fg-subtle max-w-xs mx-auto">
                {search
                  ? 'No results match your search.'
                  : 'Payments made via your Subvoy wallet will appear here. Use "Pay now" on any overdue subscription to record a payment.'}
              </p>
            </div>
          )}

          {/* Table */}
          {!loading && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50 print:bg-gray-100">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Subscription
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Amount
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                      Balance After
                    </th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide print:hidden">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((p, idx) => {
                    const name = p.description.replace(/^Paid:\s*/i, '');
                    const date = new Date(p.paidAt);
                    return (
                      <tr key={p.id}
                        className="hover:bg-gray-50 transition-colors animate-slide-in"
                        style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-900 font-medium">
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <p className="text-xs text-fg-subtle mt-0.5">
                            {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{name}</p>
                          <p className="text-xs text-fg-subtle mt-0.5">{p.currency} wallet</p>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <p className="text-sm font-bold text-red-600">
                            −{fmtAmount(p.amount, p.currency)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap hidden sm:table-cell">
                          <p className="text-sm text-gray-500">
                            {fmtAmount(p.balanceAfter, p.currency)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center print:hidden">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15 3.293 9.879a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd"/>
                            </svg>
                            Paid
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Print-only totals footer */}
                {stats && (
                  <tfoot className="hidden print:table-footer-group">
                    <tr className="bg-gray-50">
                      <td colSpan={2} className="px-6 py-3 text-sm font-bold text-gray-700">Total</td>
                      <td className="px-6 py-3 text-right">
                        {Object.entries(stats.byCurrency).map(([cur, total]) => (
                          <p key={cur} className="text-sm font-bold text-gray-900">
                            {fmtAmount(total, cur)}
                          </p>
                        ))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Print header — hidden on screen */}
        <div className="hidden print:block fixed top-0 left-0 right-0 p-6 border-b border-gray-200">
          <p className="text-lg font-bold text-gray-900">Subvoy — Payment Report</p>
          <p className="text-sm text-gray-500">{periodLabel} · {user?.email}</p>
        </div>

      </main>

      {/* ── Print styles ────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          .print\\:hidden { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
