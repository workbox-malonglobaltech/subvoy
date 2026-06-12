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
import { StatCardSkeleton, SubscriptionCardSkeleton } from '../components/Skeleton';
import { StatCard } from '../components/ui/StatCard';
import { ProgressRing } from '../components/ui/ProgressRing';
import { SubscriptionModal } from '../components/SubscriptionModal';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PayConfirmModal } from '../components/PayConfirmModal';
import { WalletChip } from '../components/WalletChip';
import { AccountMenu } from '../components/AccountMenu';
import { WALLET_ENABLED } from '../lib/features';
import { OnboardingModal } from '../components/OnboardingModal';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import { SpendByCategoryCard } from '../components/SpendByCategoryCard';
import { DueSoonCard } from '../components/DueSoonCard';
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
  const { subscriptions, loading: subLoading, add, update, remove, archive, restore, bulkDelete, refetch } = useSubscriptions(true);
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

    const result = base.filter(s => {
      const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || s.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    // Group same-name subscriptions together (alphabetical) on the All/Paused
    // lists for easy access; keep due-date order on Upcoming/Overdue.
    if (activeTab === 'all' || activeTab === 'paused') {
      result.sort((a, b) =>
        a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: 'base' })
        || new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime());
    }
    return result;
  }, [subscriptions, activeTab, upcoming, overdue, paused, active, search, categoryFilter]);

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
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-page-enter">

        {/* Page header — title + compact wallet + profile */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-h1 text-fg">Dashboard</h1>
          <div className="flex items-center gap-3">
            {WALLET_ENABLED && <WalletChip />}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {sumLoading ? (
              <>
                <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
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
                  <StatCard key={card.label} label={card.label} value={card.value} trend={card.trend} />
                ))}

                {/* 5th cell: monthly budget, one row per currency */}
                <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                  <p className="text-eyebrow uppercase text-fg-subtle">Monthly budget</p>
                  {budgetBars.length === 0 ? (
                    <Link to="/settings" className="mt-2 inline-block text-sm font-medium text-primary hover:text-primary-700">
                      Set a budget →
                    </Link>
                  ) : (
                    <div className="mt-3 flex items-center gap-3">
                      {ringBudget && <ProgressRing pct={ringBudget.pct} />}
                      <div className="min-w-0 flex-1 space-y-1">
                        {budgetBars.map(b => {
                          const over = b.limit > 0 && b.spend > b.limit;
                          return (
                            <div key={b.currency} className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-fg-subtle">{b.currency}</span>
                              {b.limit > 0 ? (
                                <span className={`font-medium tabular-nums ${over ? 'text-error-600' : 'text-fg'}`}>
                                  {over ? `over ${formatNative(b.spend - b.limit, b.currency)}` : `${Math.round(b.pct)}%`}
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

        {/* FX rate disclosure */}
        {fxRates && (
          <p className="text-right text-xs text-fg-subtle">
            {fxStale
              ? '⚠ Exchange rates may be outdated — rates are refreshed daily.'
              : `Rates as of ${new Date(fxRates.fetchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Interbank mid-market rate`
            }
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Subscription list */}
          <section className="lg:col-span-2 space-y-4" aria-label="Your subscriptions">

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
                  placeholder="Search subscriptions…"
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

            {subLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label="Loading subscriptions" aria-busy="true">
                <SubscriptionCardSkeleton /><SubscriptionCardSkeleton />
                <SubscriptionCardSkeleton /><SubscriptionCardSkeleton />
              </div>
            ) : active.length === 0 && activeTab === 'all' ? (
              <EmptyState onAddClick={openAdd} />
            ) : overdue.length === 0 && activeTab === 'overdue' ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-fg-subtle text-sm">No overdue subscriptions.</p>
              </div>
            ) : paused.length === 0 && activeTab === 'paused' ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-fg-subtle text-sm">No paused subscriptions.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-fg-subtle text-sm">No subscriptions match your search.</p>
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
                    onDelete={setDeleteConfirm}
                    onArchive={sub.isActive ? handleArchive : undefined}
                    onRestore={!sub.isActive ? handleRestore : undefined}
                    onPay={WALLET_ENABLED && sub.isActive ? handlePay : undefined}
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
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">Compliance</h2>
                  <Link to="/compliance" className="text-xs text-indigo-600 font-medium hover:text-indigo-800">View all →</Link>
                </div>
                {complianceItems.length === 0 ? (
                  <p className="text-sm text-fg-subtle">
                    No obligations yet. <Link to="/compliance" className="text-indigo-600 font-medium hover:text-indigo-800">Add one</Link>
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
                              <p className="text-sm font-medium text-gray-800 truncate max-w-[140px]">{item.title}</p>
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

            <SpendByCategoryCard byCategory={summary?.byCategory ?? []} currency={primary?.currency ?? 'USD'} />

            <DueSoonCard upcoming={upcoming} fxRates={fxRates} onPay={WALLET_ENABLED ? handlePay : undefined} />

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
