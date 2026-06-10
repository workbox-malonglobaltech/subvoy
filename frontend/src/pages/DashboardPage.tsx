import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { NavBar } from '../components/NavBar';
import { EmptyState } from '../components/EmptyState';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { useSummary } from '../hooks/useSummary';
import { useFxRates } from '../hooks/useFxRates';
import { useWallet } from '../hooks/useWallet';
import { useOnboarding, isWelcomeSeen, markWelcomeSeen } from '../hooks/useOnboarding';
import { SubscriptionCard } from '../components/SubscriptionCard';
import { StatCardSkeleton, SubscriptionCardSkeleton } from '../components/Skeleton';
import { SubscriptionModal } from '../components/SubscriptionModal';
import { PayConfirmModal } from '../components/PayConfirmModal';
import { WalletWidget } from '../components/WalletWidget';
import { OnboardingModal } from '../components/OnboardingModal';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Subscription, CreateSubscriptionInput } from '../../../src/shared/types';
import { formatNative, toMonthlyNgn, convertAmount } from '../utils/currency';
import { useAnalytics } from '../hooks/useAnalytics';
import { useNotificationPrefs } from '../hooks/useNotificationPrefs';
import { api, ApiError } from '../lib/api';

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16',
];

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr).getTime() - today.getTime()) / 86400000);
}

type Tab = 'all' | 'overdue' | 'upcoming' | 'paused';

export function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { subscriptions, loading: subLoading, add, update, remove, archive, restore, bulkDelete, refetch } = useSubscriptions(true);
  // Bump on any mutation so the summary refetches — count alone misses edits.
  const [summaryKey, setSummaryKey] = useState(0);
  const refreshSummary = () => setSummaryKey(k => k + 1);
  const { summary, loading: sumLoading } = useSummary([summaryKey]);
  const { rates: fxRates, stale: fxStale, ngnRateChangePct } = useFxRates();
  const { wallet, loading: walletLoading } = useWallet();
  const { data: analyticsData } = useAnalytics();
  const notifPrefs = useNotificationPrefs();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [payConfirm, setPayConfirm] = useState<Subscription | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  // ── Onboarding ──────────────────────────────────────────────────────────────
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState(
    () => localStorage.getItem('subvoy_checklist_dismissed') === '1'
  );

  // Show the welcome modal once for new registrations
  useEffect(() => {
    if (!subLoading && localStorage.getItem('subvoy_new_user') === '1' && !isWelcomeSeen()) {
      localStorage.removeItem('subvoy_new_user');
      setOnboardingModalOpen(true);
    }
  }, [subLoading]);

  const { steps, completedCount, allDone, progress } = useOnboarding({
    subscriptionCount: subscriptions.length,
    walletUsd: wallet?.usdBalance ?? 0,
    walletNgn: wallet?.ngnBalance ?? 0,
    walletLoading,
  });

  const showChecklist = !checklistDismissed && !allDone;

  function dismissChecklist() {
    localStorage.setItem('subvoy_checklist_dismissed', '1');
    setChecklistDismissed(true);
  }

  // Bulk select state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Micro-interaction state
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [savedId, setSavedId] = useState<string | null>(null);

  const active = subscriptions.filter(s => s.isActive);
  const paused = subscriptions.filter(s => !s.isActive);

  const overdue = active.filter(s => daysUntil(s.nextBillingDate) < 0);

  const upcoming = active
    .filter(s => daysUntil(s.nextBillingDate) <= 30)
    .sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime());

  const categories = useMemo(() => {
    const cats = new Set(active.map(s => s.category).filter(Boolean) as string[]);
    return ['All', ...Array.from(cats).sort()];
  }, [active]);

  // Total monthly spend converted to NGN for the summary banner
  const totalMonthlyNgn = useMemo(() => {
    if (!fxRates) return null;
    return active.reduce((sum, s) => sum + toMonthlyNgn(s.amount, s.currency, s.billingCycle, fxRates), 0);
  }, [active, fxRates]);

  // ── Month-over-month spend trend (from analytics monthly history) ───────────
  const trendPct = useMemo(() => {
    if (!analyticsData?.months.length) return null;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const currentYM = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYM = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;
    const thisMo = analyticsData.months.find(m => m.month === currentYM)?.total ?? 0;
    const lastMo = analyticsData.months.find(m => m.month === prevYM)?.total ?? 0;
    if (lastMo === 0) return null;
    return ((thisMo - lastMo) / lastMo) * 100;
  }, [analyticsData]);

  // Native per-currency spend totals (no conversion). Primary = highest monthly.
  const byCurrency = summary?.byCurrency ?? [];
  const primary = byCurrency[0] ?? null;
  const spendLines = (kind: 'monthlySpend' | 'yearlySpend') =>
    byCurrency.length === 0
      ? <span>—</span>
      : <>{byCurrency.map(c => <div key={c.currency}>{formatNative(c[kind], c.currency)}</div>)}</>;

  // ── Budget bar (tracks the primary currency's monthly spend) ──────────────────
  const budgetPct = useMemo(() => {
    if (!notifPrefs?.budgetAlertEnabled || !notifPrefs.budgetLimit) return null;
    const primaryMonthly = summary?.byCurrency?.[0]?.monthlySpend;
    if (primaryMonthly == null) return null;
    return (primaryMonthly / notifPrefs.budgetLimit) * 100;
  }, [notifPrefs, summary]);

  const daysLeftInMonth = useMemo(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return lastDay - now.getDate();
  }, []);

  const filtered = useMemo(() => {
    let base: Subscription[];
    if (activeTab === 'upcoming') base = upcoming;
    else if (activeTab === 'overdue') base = overdue;
    else if (activeTab === 'paused') base = paused;
    else base = active;

    const result = base.filter(s => {
      const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || s.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    // Group same-name subscriptions together (alphabetical) on the All/Paused
    // lists for easy access; keep due-date order on Upcoming/Overdue.
    if (activeTab === 'all' || activeTab === 'paused') {
      result.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        || new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime());
    }
    return result;
  }, [subscriptions, activeTab, upcoming, overdue, paused, active, search, categoryFilter]);

  function openAdd() { setEditing(null); setModalOpen(true); }
  function openEdit(sub: Subscription) { setEditing(sub); setModalOpen(true); }

  function toggleSelect(id: string, checked: boolean) {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(s => s.id)));
    }
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      await bulkDelete(Array.from(selected));
      refreshSummary();
      toast.success(`${selected.size} subscription${selected.size !== 1 ? 's' : ''} paused`);
      exitSelectMode();
    } catch {
      toast.error('Failed to pause subscriptions');
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleSave(data: CreateSubscriptionInput) {
    if (editing) {
      const saved = await update(editing.id, data);
      toast.success('Subscription updated');
      // Flash the card green briefly
      setSavedId(saved.id);
      setTimeout(() => setSavedId(null), 1400);
    } else {
      try {
        const saved = await add(data);
        toast.success('Subscription added');
        // Flash the newly-added card green briefly
        setSavedId(saved.id);
        setTimeout(() => setSavedId(null), 1400);
      } catch (err) {
        // Plan cap reached → close the modal and take them to the upgrade page.
        if (err instanceof ApiError && err.status === 402) {
          setModalOpen(false);
          setEditing(null);
          toast.info("You've reached your plan limit — here are your upgrade options.");
          navigate('/plans');
          return;
        }
        throw err; // other errors surface in the modal
      }
    }
    refreshSummary(); // refresh totals after add/edit
  }

  async function handleDelete(id: string) {
    setDeleteConfirm(null);
    // Kick off the exit animation immediately; API call follows
    setRemovingIds(prev => new Set(prev).add(id));
    // Small delay so the fade-out is visible before the DOM node disappears
    await new Promise(r => setTimeout(r, 220));
    try {
      await remove(id);
      refreshSummary();
      toast.success('Subscription removed');
    } catch {
      // Restore the card if the API call fails
      setRemovingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      toast.error('Failed to remove subscription');
    }
  }

  async function handleArchive(id: string) {
    await archive(id);
    refreshSummary();
    toast.success('Subscription paused');
  }

  async function handleRestore(id: string) {
    await restore(id);
    refreshSummary();
    toast.success('Subscription restored');
  }

  async function handlePay(id: string) {
    const sub = subscriptions.find(s => s.id === id) ?? null;
    setPayConfirm(sub);
  }

  async function confirmPay() {
    if (!payConfirm) return;
    await api.post<{ subscription: Subscription; wallet: unknown }>(
      `/subscriptions/${payConfirm.id}/pay`,
      {}
    );
    await refetch();
    refreshSummary();
    toast.success('Payment recorded — next billing date updated');
    setPayConfirm(null);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar actions={
        <button
          onClick={openAdd}
          className="rounded-lg bg-indigo-600 px-3 sm:px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          + Add
        </button>
      } />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-page-enter">

        {/* Wallet balance widget */}
        <WalletWidget />

        {/* FX rate movement alert — shown when NGN rate shifted >3% */}
        {ngnRateChangePct !== null && Math.abs(ngnRateChangePct) >= 3 && (
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            ngnRateChangePct > 0
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`} role="alert">
            <span className="text-lg leading-none mt-0.5" aria-hidden="true">
              {ngnRateChangePct > 0 ? '📈' : '📉'}
            </span>
            <div>
              <p className="font-semibold">
                Dollar {ngnRateChangePct > 0 ? 'strengthened' : 'weakened'} {Math.abs(ngnRateChangePct).toFixed(1)}% against the naira
              </p>
              <p className="text-xs mt-0.5 opacity-80">
                Your USD subscriptions now cost {ngnRateChangePct > 0 ? 'more' : 'less'} in naira terms.
                {totalMonthlyNgn !== null && ` Total: ${formatNative(totalMonthlyNgn, 'NGN')}/mo`}
              </p>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {sumLoading ? (
            <>
              <StatCardSkeleton /><StatCardSkeleton />
              <StatCardSkeleton /><StatCardSkeleton />
            </>
          ) : (
            <>
              {[
                { label: 'Monthly spend', value: spendLines('monthlySpend'), trend: trendPct },
                { label: 'Yearly spend',  value: spendLines('yearlySpend'),  trend: null as number | null },
                { label: 'Active subs',   value: String(summary?.activeCount ?? 0), trend: null as number | null },
                { label: 'Due this week', value: String(summary?.due7Days ?? 0), trend: null as number | null },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{card.label}</p>
                  <div className="mt-2 text-2xl font-bold text-gray-900 leading-tight space-y-0.5">{card.value}</div>
                  {card.trend !== null && (
                    <p className={`text-xs mt-1 flex items-center gap-0.5 font-medium ${
                      card.trend > 0 ? 'text-red-500' : 'text-emerald-600'
                    }`}>
                      {card.trend > 0 ? '↑' : '↓'} {Math.abs(card.trend).toFixed(0)}% vs last month
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Budget progress bar — tracks the primary currency's monthly spend */}
        {budgetPct !== null && notifPrefs?.budgetLimit && primary && (
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Monthly budget</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatNative(primary.monthlySpend, primary.currency)}
                <span className="text-gray-400 font-normal"> of {formatNative(notifPrefs.budgetLimit, primary.currency)}</span>
              </p>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetPct >= 100 ? 'bg-red-500' :
                  budgetPct >= 75  ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {Math.round(budgetPct)}% used
              {budgetPct >= 100
                ? ' — budget exceeded'
                : ` · ${formatNative(notifPrefs.budgetLimit - primary.monthlySpend, primary.currency)} remaining · ${daysLeftInMonth}d left this month`
              }
            </p>
          </div>
        )}

        {/* FX rate disclosure */}
        {fxRates && (
          <p className="text-xs text-gray-400 -mt-6">
            {fxStale
              ? '⚠ Exchange rates may be outdated — rates are refreshed daily.'
              : `Rates as of ${new Date(fxRates.fetchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Interbank mid-market rate`
            }
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Subscription list */}
          <div className="lg:col-span-2 space-y-4">

            {/* Search bar + quick add */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  placeholder="Search subscriptions…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  aria-label="Search subscriptions"
                />
              </div>
              <button
                onClick={openAdd}
                className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
              >
                + Add subscription
              </button>
            </div>

            {/* Category filter pills */}
            {activeTab !== 'paused' && categories.length > 1 && (
              <div
                className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5 scrollbar-none"
                role="group"
                aria-label="Filter by category"
              >
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      categoryFilter === cat
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600'
                    }`}
                    aria-pressed={categoryFilter === cat}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Tab toggle + bulk controls */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1" role="tablist" aria-label="Subscription filter">
                {(['all', 'overdue', 'upcoming', 'paused'] as Tab[]).map(tab => (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={activeTab === tab}
                    onClick={() => { setActiveTab(tab); exitSelectMode(); }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize flex items-center gap-1.5 ${
                      activeTab === tab
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'all' && `All (${active.length})`}
                    {tab === 'overdue' && (
                      <>
                        Overdue
                        {overdue.length > 0 && (
                          <span className="rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-xs font-semibold leading-none">
                            {overdue.length}
                          </span>
                        )}
                      </>
                    )}
                    {tab === 'upcoming' && (
                      <>
                        Upcoming
                        {upcoming.length > 0 && (
                          <span className="rounded-full bg-indigo-100 text-indigo-700 px-1.5 py-0.5 text-xs font-semibold leading-none">
                            {upcoming.length}
                          </span>
                        )}
                      </>
                    )}
                    {tab === 'paused' && `Paused (${paused.length})`}
                  </button>
                ))}
              </div>

              {/* Bulk controls */}
              {activeTab !== 'paused' && active.length > 0 && (
                selectMode ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleSelectAll}
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                    >
                      {selected.size === filtered.length ? 'Deselect all' : 'Select all'}
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      disabled={selected.size === 0 || bulkDeleting}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {bulkDeleting ? 'Pausing…' : `Pause ${selected.size > 0 ? `(${selected.size})` : ''}`}
                    </button>
                    <button
                      onClick={exitSelectMode}
                      className="text-xs text-gray-400 hover:text-gray-600 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectMode(true)}
                    className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
                  >
                    Select
                  </button>
                )
              )}
            </div>

            {subLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label="Loading subscriptions" aria-busy="true">
                <SubscriptionCardSkeleton /><SubscriptionCardSkeleton />
                <SubscriptionCardSkeleton /><SubscriptionCardSkeleton />
              </div>
            ) : active.length === 0 && activeTab === 'all' ? (
              <EmptyState onAddClick={openAdd} />
            ) : overdue.length === 0 && activeTab === 'overdue' ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-gray-400 text-sm">No overdue subscriptions.</p>
              </div>
            ) : paused.length === 0 && activeTab === 'paused' ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-gray-400 text-sm">No paused subscriptions.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-gray-400 text-sm">No subscriptions match your search.</p>
                <button
                  onClick={() => { setSearch(''); setCategoryFilter('All'); }}
                  className="mt-2 text-sm text-indigo-600 font-medium hover:text-indigo-700"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filtered.map(sub => (
                  <SubscriptionCard
                    key={sub.id}
                    sub={sub}
                    onEdit={openEdit}
                    onDelete={id => setDeleteConfirm(id)}
                    onArchive={sub.isActive ? handleArchive : undefined}
                    onRestore={!sub.isActive ? handleRestore : undefined}
                    onPay={sub.isActive ? handlePay : undefined}
                    selectable={selectMode && sub.isActive}
                    selected={selected.has(sub.id)}
                    onSelect={toggleSelect}
                    fxRates={fxRates}
                    isRemoving={removingIds.has(sub.id)}
                    justSaved={savedId === sub.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">

            {/* Onboarding checklist */}
            {showChecklist && (
              <OnboardingChecklist
                steps={steps}
                completedCount={completedCount}
                progress={progress}
                onDismiss={dismissChecklist}
                onAddSubscription={openAdd}
              />
            )}

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Spend by category</h2>
              {!summary || summary.byCategory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No data yet</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={summary.byCategory}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                      >
                        {summary.byCategory.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatNative(Number(v), primary?.currency ?? 'USD')} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3">
                    {summary.byCategory.map((c, i) => (
                      <div key={c.category} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: COLORS[i % COLORS.length] }}
                            aria-hidden="true"
                          />
                          <span className="text-gray-600 truncate max-w-[120px]">{c.category}</span>
                        </div>
                        <span className="font-medium text-gray-900">{formatNative(c.total, primary?.currency ?? 'USD')}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Due soon</h2>
              {upcoming.slice(0, 5).length === 0 ? (
                <p className="text-sm text-gray-400">Nothing due in the next 30 days</p>
              ) : (
                <ul className="space-y-3">
                  {upcoming.slice(0, 5).map(sub => {
                    const days = daysUntil(sub.nextBillingDate);
                    const ngnEquiv = fxRates && sub.currency !== 'NGN'
                      ? convertAmount(sub.amount, sub.currency, 'NGN', fxRates)
                      : null;
                    return (
                      <li key={sub.id} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate max-w-[120px]">{sub.name}</p>
                          <p className={`text-xs font-medium ${
                            days < 0 ? 'text-red-600' :
                            days === 0 ? 'text-red-500' :
                            days <= 3  ? 'text-amber-600' : 'text-gray-400'
                          }`}>
                            {days < 0
                              ? `${Math.abs(days)}d overdue`
                              : days === 0 ? 'Due today'
                              : `In ${days}d`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency', currency: sub.currency,
                            }).format(sub.amount)}
                          </p>
                          {ngnEquiv !== null && (
                            <p className="text-xs text-emerald-600">{formatNative(ngnEquiv, 'NGN')}</p>
                          )}
                          {days <= 0 && (
                            <button
                              onClick={() => handlePay(sub.id)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors mt-0.5"
                            >
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
          </div>
        </div>
      </main>

      {onboardingModalOpen && (
        <OnboardingModal
          userName={user?.name ?? null}
          onClose={() => {
            markWelcomeSeen();
            setOnboardingModalOpen(false);
          }}
          onAddSubscription={() => {
            markWelcomeSeen();
            setOnboardingModalOpen(false);
            openAdd();
          }}
        />
      )}

      <SubscriptionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
        initial={editing}
        defaultCurrency={primary?.currency}
      />

      {payConfirm && (
        <PayConfirmModal
          sub={payConfirm}
          onConfirm={confirmPay}
          onClose={() => setPayConfirm(null)}
        />
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setDeleteConfirm(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 id="delete-dialog-title" className="font-semibold text-gray-900 mb-2">
              Delete subscription?
            </h3>
            <p className="text-sm text-gray-500 mb-5">This will remove it permanently.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
