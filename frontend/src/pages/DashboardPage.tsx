import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useCompliance } from '../hooks/useCompliance';
import { useToast } from '../contexts/ToastContext';
import { EmptyState } from '../components/EmptyState';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { useSummary } from '../hooks/useSummary';
import { useFxRates } from '../hooks/useFxRates';
import { useWallet } from '../hooks/useWallet';
import { useOnboarding, isWelcomeSeen, markWelcomeSeen } from '../hooks/useOnboarding';
import { SubscriptionCard } from '../components/SubscriptionCard';
import { SubscriptionList } from '../components/SubscriptionList';
import { StatCardSkeleton, SubscriptionCardSkeleton } from '../components/Skeleton';
import { StatCard } from '../components/ui/StatCard';
import { ProgressRing } from '../components/ui/ProgressRing';
import { SelectMenu } from '../components/ui/SelectMenu';
import { SubscriptionModal } from '../components/SubscriptionModal';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PayConfirmModal } from '../components/PayConfirmModal';
import { WalletChip } from '../components/WalletChip';
import { AccountMenu } from '../components/AccountMenu';
import { NotificationBell } from '../components/NotificationBell';
import { WALLET_ENABLED } from '../lib/features';
import { OnboardingModal } from '../components/OnboardingModal';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import { SpendByCategoryCard } from '../components/SpendByCategoryCard';
import { DueSoonCard } from '../components/DueSoonCard';
import { ExchangeRatesCard } from '../components/ExchangeRatesCard';
import { RenewalsTimeline } from '../components/RenewalsTimeline';
import { Subscription, CreateSubscriptionInput } from '../../../src/shared/types';
import { formatNative, toMonthlyNgn } from '../utils/currency';
import { useAnalytics } from '../hooks/useAnalytics';
import { useNotificationPrefs } from '../hooks/useNotificationPrefs';
import { api, ApiError } from '../lib/api';
import { daysUntil } from '../lib/date';


type Tab = 'all' | 'overdue' | 'upcoming' | 'paused';

export function DashboardPage() {
  const { user } = useAuth();
  const { active: activeWorkspace } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  // Business workspaces track compliance too — show it alongside subscriptions.
  const isBusiness = activeWorkspace?.type === 'business';
  const { items: complianceItems } = useCompliance(isBusiness);
  const { subscriptions, loading: subLoading, add, update, remove, archive, restore, bulkDelete, markPaid, refetch } = useSubscriptions(true);
  // Bump on any mutation so the summary refetches — count alone misses edits.
  const [summaryKey, setSummaryKey] = useState(0);
  const refreshSummary = useCallback(() => setSummaryKey(k => k + 1), []);
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
  const [sortBy, setSortBy] = useState<'default' | 'due' | 'amount' | 'name'>('default');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
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

  // 12-month spend series for the KPI sparklines.
  const monthlyTotals = useMemo(() => (analyticsData?.months ?? []).map(m => m.total), [analyticsData]);

  // Native per-currency spend totals (no conversion). Primary = highest monthly.
  const byCurrency = summary?.byCurrency ?? [];
  const primary = byCurrency[0] ?? null;
  // Per-currency side-by-side with a divider (e.g. "$41.00 | ₦363,333"), no wrap,
  // no conversion. Smaller weight than the 2xl wrapper so wide ₦ values fit.
  const spendLines = (kind: 'monthlySpend' | 'yearlySpend') =>
    byCurrency.length === 0
      ? <span>—</span>
      : (
        <div className="flex items-stretch divide-x divide-line">
          {byCurrency.map((c, i) => (
            <div key={c.currency} className={i === 0 ? 'pr-3.5' : 'px-3.5'}>
              <span className="block whitespace-nowrap text-xl font-bold leading-none">{formatNative(c[kind], c.currency)}</span>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">{c.currency}</span>
            </div>
          ))}
        </div>
      );

  // ── Budget bars — one per currency that has a budget set (native, no conversion) ──
  // One row per spent currency (e.g. USD + NGN). Currencies without a configured
  // limit still show, with a "Set →" prompt, so the user can budget each one.
  const budgetBars = (notifPrefs?.budgetAlertEnabled ? byCurrency : [])
    .map(c => ({ currency: c.currency, spend: c.monthlySpend, limit: notifPrefs?.budgetLimits?.[c.currency] ?? 0 }))
    .map(c => ({ ...c, pct: c.limit > 0 ? (c.spend / c.limit) * 100 : 0 }));
  // Headline ring uses the first currency that actually has a budget set.
  const ringBudget = budgetBars.find(b => b.limit > 0);

  const filtered = useMemo(() => {
    let base: Subscription[];
    if (activeTab === 'upcoming') base = upcoming;
    else if (activeTab === 'overdue') base = overdue;
    else if (activeTab === 'paused') base = paused;
    else base = active;

    const q = search.trim().toLowerCase();
    const result = base.filter(s => {
      const matchesSearch = !q
        || s.name.toLowerCase().includes(q)
        || (s.category ?? '').toLowerCase().includes(q)
        || (s.service ?? '').toLowerCase().includes(q)
        || (s.notes ?? '').toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'All' || s.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    // Explicit sort wins; otherwise group same-name subs together on All/Paused
    // and keep due-date order on Upcoming/Overdue.
    if (sortBy === 'due') {
      result.sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime());
    } else if (sortBy === 'amount') {
      result.sort((a, b) => b.amount - a.amount);
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: 'base' }));
    } else if (activeTab === 'all' || activeTab === 'paused') {
      result.sort((a, b) =>
        a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: 'base' })
        || new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime());
    }
    return result;
  }, [subscriptions, activeTab, upcoming, overdue, paused, active, search, categoryFilter, sortBy]);

  const openAdd = useCallback(() => { setEditing(null); setModalOpen(true); }, []);
  const openEdit = useCallback((sub: Subscription) => { setEditing(sub); setModalOpen(true); }, []);

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

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

  const handleArchive = useCallback(async (id: string) => {
    await archive(id);
    refreshSummary();
    toast.success('Subscription paused');
  }, [archive, refreshSummary, toast]);

  const handleRestore = useCallback(async (id: string) => {
    await restore(id);
    refreshSummary();
    toast.success('Subscription restored');
  }, [restore, refreshSummary, toast]);

  const handlePay = useCallback(async (id: string) => {
    const sub = subscriptions.find(s => s.id === id) ?? null;
    setPayConfirm(sub);
  }, [subscriptions]);

  const handleMarkPaid = useCallback(async (id: string) => {
    await markPaid(id);
    refreshSummary();
    toast.success('Marked as paid — moved to the next cycle');
  }, [markPaid, refreshSummary, toast]);

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
    <>
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-page-enter">

        {/* Page header — title + compact wallet + profile */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-h1 text-fg">Dashboard</h1>
          <div className="flex items-center gap-3">
            {WALLET_ENABLED && <WalletChip />}
            <NotificationBell />
            <AccountMenu />
          </div>
        </div>

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

        {/* Key metrics */}
        <section aria-labelledby="kpi-heading">
          <h2 id="kpi-heading" className="sr-only">Key metrics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sumLoading ? (
              <>
                <StatCardSkeleton /><StatCardSkeleton />
                <StatCardSkeleton /><StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard
                  label="Monthly spend"
                  value={spendLines('monthlySpend')}
                  trend={trendPct}
                  sparkline={monthlyTotals}
                  icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M6 5h12a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3V8a3 3 0 013-3zm1 11h3" /></svg>}
                />
                <StatCard
                  label="Yearly spend"
                  value={spendLines('yearlySpend')}
                  sparkline={monthlyTotals}
                  iconClassName="bg-info-50 text-info-600"
                  icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                />

                {/* Active subs + Due this week, combined */}
                <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning-50 text-warning-600">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-baseline gap-2.5">
                      <span className="w-9 text-2xl font-bold tabular-nums text-fg">{summary?.activeCount ?? 0}</span>
                      <span className="text-sm text-fg-muted">Active subs</span>
                    </div>
                    <div className="flex items-baseline gap-2.5">
                      <span className="w-9 text-2xl font-bold tabular-nums text-fg">{summary?.due7Days ?? 0}</span>
                      <span className="text-sm text-fg-muted">Due this week</span>
                    </div>
                  </div>
                </div>

                {/* Monthly budget — ring + per-currency rows */}
                <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-50 text-success-600">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                    </span>
                  </div>
                  <p className="text-eyebrow uppercase text-fg-subtle">Monthly budget</p>
                  {budgetBars.length === 0 ? (
                    <Link to="/settings" className="mt-2 inline-block text-sm font-medium text-primary hover:text-primary-700">
                      Set a budget →
                    </Link>
                  ) : (
                    <div className="mt-3 flex items-center gap-3">
                      {ringBudget && <ProgressRing pct={ringBudget.pct} size={42} />}
                      <div className="min-w-0 flex-1 space-y-1">
                        {budgetBars.map(b => {
                          const over = b.limit > 0 && b.spend > b.limit;
                          return (
                            <div key={b.currency} className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-fg-subtle">{b.currency}</span>
                              {b.limit > 0 ? (
                                <span className={`font-medium tabular-nums ${over ? 'text-error-600' : 'text-fg'}`}>
                                  {over
                                    ? `over ${formatNative(b.spend - b.limit, b.currency)}`
                                    : `${formatNative(b.spend, b.currency)} / ${formatNative(b.limit, b.currency)}`}
                                </span>
                              ) : (
                                <Link to="/settings" className="font-medium text-primary hover:text-primary-700">Set →</Link>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Subscription list */}
          <section className="lg:col-span-3 space-y-4" aria-label="Your subscriptions">

            {/* Search bar + quick add */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  placeholder="Search by name, category, notes…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label="Search subscriptions"
                />
              </div>
              <Button onClick={openAdd} className="shrink-0 whitespace-nowrap">+ Add subscription</Button>
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
                        ? 'bg-primary text-primary-fg shadow-sm'
                        : 'bg-surface border border-line text-fg-muted hover:border-primary/40 hover:text-primary'
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
              <div className="flex gap-1 bg-surface-muted rounded-lg p-1" role="tablist" aria-label="Subscription filter">
                {(['all', 'overdue', 'upcoming', 'paused'] as Tab[]).map(tab => (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={activeTab === tab}
                    onClick={() => { setActiveTab(tab); exitSelectMode(); }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize flex items-center gap-1.5 ${
                      activeTab === tab
                        ? 'bg-surface text-fg shadow-sm'
                        : 'text-fg-subtle hover:text-fg'
                    }`}
                  >
                    {tab === 'all' && `All (${active.length})`}
                    {tab === 'overdue' && (
                      <>
                        Overdue
                        {overdue.length > 0 && (
                          <span className="rounded-full bg-error-50 text-error-700 px-1.5 py-0.5 text-xs font-semibold leading-none">
                            {overdue.length}
                          </span>
                        )}
                      </>
                    )}
                    {tab === 'upcoming' && (
                      <>
                        Upcoming
                        {upcoming.length > 0 && (
                          <span className="rounded-full bg-primary-50 text-primary-700 px-1.5 py-0.5 text-xs font-semibold leading-none">
                            {upcoming.length}
                          </span>
                        )}
                      </>
                    )}
                    {tab === 'paused' && `Paused (${paused.length})`}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <SelectMenu
                  value={sortBy}
                  onChange={v => setSortBy(v as typeof sortBy)}
                  label="Sort:"
                  options={[
                    { value: 'default', label: 'Default' },
                    { value: 'due', label: 'Next due' },
                    { value: 'amount', label: 'Amount (high→low)' },
                    { value: 'name', label: 'Name (A→Z)' },
                  ]}
                />
                <div className="flex rounded-lg border border-line p-0.5">
                  <button onClick={() => setViewMode('cards')} aria-pressed={viewMode === 'cards'} aria-label="Card view" title="Cards"
                    className={`rounded-md p-1.5 transition-colors ${viewMode === 'cards' ? 'bg-surface-muted text-fg' : 'text-fg-subtle hover:text-fg'}`}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  </button>
                  <button onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'} aria-label="List view" title="List"
                    className={`rounded-md p-1.5 transition-colors ${viewMode === 'list' ? 'bg-surface-muted text-fg' : 'text-fg-subtle hover:text-fg'}`}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </button>
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
                      className="rounded-lg bg-error-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-error-700 disabled:opacity-50 transition-colors"
                    >
                      {bulkDeleting ? 'Pausing…' : `Pause ${selected.size > 0 ? `(${selected.size})` : ''}`}
                    </button>
                    <button
                      onClick={exitSelectMode}
                      className="text-xs text-fg-subtle hover:text-gray-600 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectMode(true)}
                    className="text-xs text-fg-subtle hover:text-gray-600 font-medium transition-colors"
                  >
                    Select
                  </button>
                )
              )}
              </div>
            </div>

            {subLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label="Loading subscriptions" aria-busy="true">
                <SubscriptionCardSkeleton /><SubscriptionCardSkeleton />
                <SubscriptionCardSkeleton /><SubscriptionCardSkeleton />
              </div>
            ) : active.length === 0 && activeTab === 'all' ? (
              <EmptyState onAddClick={openAdd} />
            ) : overdue.length === 0 && activeTab === 'overdue' ? (
              <div className="bg-surface rounded-2xl border border-dashed border-line p-10 text-center">
                <p className="text-fg-subtle text-sm">No overdue subscriptions.</p>
              </div>
            ) : paused.length === 0 && activeTab === 'paused' ? (
              <div className="bg-surface rounded-2xl border border-dashed border-line p-10 text-center">
                <p className="text-fg-subtle text-sm">No paused subscriptions.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-surface rounded-2xl border border-dashed border-line p-10 text-center">
                <p className="text-fg-subtle text-sm">No subscriptions match your search.</p>
                <button
                  onClick={() => { setSearch(''); setCategoryFilter('All'); }}
                  className="mt-2 text-sm text-primary font-medium hover:text-primary-700"
                >
                  Clear filters
                </button>
              </div>
            ) : viewMode === 'list' ? (
              <SubscriptionList
                subs={filtered}
                onEdit={openEdit}
                onDelete={setDeleteConfirm}
                onArchive={handleArchive}
                onRestore={handleRestore}
                onMarkPaid={handleMarkPaid}
                fxRates={fxRates}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(sub => (
                  <SubscriptionCard
                    key={sub.id}
                    sub={sub}
                    onEdit={openEdit}
                    onDelete={setDeleteConfirm}
                    onArchive={sub.isActive ? handleArchive : undefined}
                    onRestore={!sub.isActive ? handleRestore : undefined}
                    onPay={WALLET_ENABLED && sub.isActive ? handlePay : undefined}
                    onMarkPaid={sub.isActive ? handleMarkPaid : undefined}
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
          </section>

          {/* Sidebar */}
          <aside className="space-y-5" aria-label="Overview">

            {/* Compliance — business workspaces track obligations alongside subscriptions */}
            {isBusiness && (
              <div className="bg-surface rounded-2xl border border-line p-5 shadow-card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-fg-muted">Compliance</h2>
                  <Link to="/compliance" className="text-xs text-primary font-medium hover:text-primary-700">View all →</Link>
                </div>
                {complianceItems.length === 0 ? (
                  <p className="text-sm text-fg-subtle">
                    No obligations yet. <Link to="/compliance" className="text-primary font-medium hover:text-primary-700">Add one</Link>
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {[...complianceItems]
                      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                      .slice(0, 5)
                      .map(item => {
                        const d = daysUntil(item.dueDate);
                        return (
                          <li key={item.id} className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-fg truncate max-w-[140px]">{item.title}</p>
                              <p className="text-xs text-fg-subtle truncate max-w-[140px]">{item.authority ?? 'Obligation'}</p>
                            </div>
                            <span className={`text-xs font-medium shrink-0 ${
                              item.status === 'completed' ? 'text-emerald-600'
                              : item.overdue ? 'text-red-600'
                              : d <= 7 ? 'text-amber-600' : 'text-fg-subtle'
                            }`}>
                              {item.status === 'completed' ? 'Done'
                                : item.overdue ? `${Math.abs(d)}d overdue`
                                : d === 0 ? 'Due today'
                                : `In ${d}d`}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
            )}

            <DueSoonCard upcoming={upcoming} fxRates={fxRates} onPay={WALLET_ENABLED ? handlePay : undefined} />

            <RenewalsTimeline subscriptions={subscriptions} />

            <SpendByCategoryCard
              byCategory={summary?.byCategory ?? []}
              currency={primary?.currency ?? 'USD'}
              onSelectCategory={cat => setCategoryFilter(prev => prev === cat ? 'All' : cat)}
              activeCategory={categoryFilter}
            />

            {fxRates && (
              <ExchangeRatesCard
                fxRates={fxRates}
                currencies={byCurrency.map(c => c.currency)}
                stale={fxStale}
              />
            )}

            {/* Onboarding checklist — kept last so real data leads the rail */}
            {showChecklist && (
              <OnboardingChecklist
                steps={steps}
                completedCount={completedCount}
                progress={progress}
                onDismiss={dismissChecklist}
                onAddSubscription={openAdd}
              />
            )}
          </aside>
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
        <Modal
          open
          onClose={() => setDeleteConfirm(null)}
          title="Delete subscription?"
          description="This will remove it permanently."
          className="max-w-sm"
        >
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
