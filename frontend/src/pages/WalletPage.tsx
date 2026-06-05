import { useState, useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import { useWallet } from '../hooks/useWallet';
import { TopUpModal } from '../components/TopUpModal';
import { AutoTopUpPanel } from '../components/AutoTopUpPanel';
import { NavBar } from '../components/NavBar';
import type { WalletSettings, WalletTopUpInput } from '../../../src/shared/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNgn(amount: number) {
  return '₦' + amount.toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

function formatUsd(amount: number) {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const TX_TYPE_LABEL: Record<string, string> = {
  deposit: 'Deposit',
  payment: 'Payment',
  conversion: 'Conversion',
  auto_topup: 'Auto Top-Up',
};

const TX_TYPE_COLOR: Record<string, string> = {
  deposit: 'bg-emerald-100 text-emerald-700',
  payment: 'bg-blue-100 text-blue-700',
  conversion: 'bg-purple-100 text-purple-700',
  auto_topup: 'bg-indigo-100 text-indigo-700',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function WalletPage() {
  const toast = useToast();
  const { wallet, transactions, settings, loading, error, topUp, updateSettings, refresh } = useWallet();
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // ── Top-up ──────────────────────────────────────────────────────────────────

  async function handleTopUp(input: WalletTopUpInput) {
    await topUp(input);
    toast.success(
      input.destination === 'usd'
        ? `₦${input.amountNgn.toLocaleString()} converted and credited to your USD card`
        : `₦${input.amountNgn.toLocaleString()} added to your NGN balance`
    );
  }

  // ── Settings (debounce-free: save on blur / select change) ──────────────────

  const handleSettingsChange = useCallback(async (data: Partial<WalletSettings>) => {
    setSettingsSaving(true);
    try {
      await updateSettings(data);
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  }, [updateSettings, toast]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar actions={
        <button
          onClick={() => setTopUpOpen(true)}
          className="rounded-lg bg-indigo-600 px-3 sm:px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          + Fund
        </button>
      } />

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6 animate-page-enter">
        {/* ── Page title ──────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your balances and auto top-up settings</p>
        </div>

        {/* ── Loading / error states ───────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={refresh} className="text-sm font-medium text-red-700 hover:text-red-900 underline">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && wallet && (
          <>
            {/* ── Balance cards ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* USD Card */}
              <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 p-5 text-white shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-indigo-200">USD Dollar Card</span>
                  <span className="text-lg">💳</span>
                </div>
                <p className="text-3xl font-bold tracking-tight">{formatUsd(wallet.usdBalance)}</p>
                <p className="text-xs text-indigo-300 mt-1">Available for subscriptions</p>
              </div>

              {/* NGN Balance */}
              <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-500">NGN Balance</span>
                  <span className="text-lg">🏦</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 tracking-tight">{formatNgn(wallet.ngnBalance)}</p>
                <p className="text-xs text-gray-400 mt-1">Local naira balance</p>
              </div>
            </div>

            {/* ── Fund button (larger, below cards on mobile) ───────────────── */}
            <button
              onClick={() => setTopUpOpen(true)}
              className="w-full rounded-2xl border-2 border-dashed border-indigo-300 py-4 text-sm font-semibold text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Fund Wallet
            </button>

            {/* ── Spending insights ────────────────────────────────────────── */}
            {transactions.length > 0 && (() => {
              const now = new Date();
              const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
              const payments = transactions.filter(
                tx => tx.type === 'payment' && tx.direction === 'out' &&
                      new Date(tx.createdAt) >= monthStart
              );
              const usdSpent = payments
                .filter(tx => tx.currency === 'USD')
                .reduce((sum, tx) => sum + tx.amount, 0);
              const ngnSpent = payments
                .filter(tx => tx.currency === 'NGN')
                .reduce((sum, tx) => sum + tx.amount, 0);
              const count = payments.length;
              if (count === 0) return null;
              const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              return (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3">
                    Spending this month
                    <span className="ml-2 text-xs font-normal text-gray-400">{monthLabel}</span>
                  </h2>
                  <div className="flex flex-wrap gap-4">
                    {usdSpent > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">USD paid</p>
                        <p className="text-xl font-bold text-gray-900">{formatUsd(usdSpent)}</p>
                      </div>
                    )}
                    {ngnSpent > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">NGN paid</p>
                        <p className="text-xl font-bold text-gray-900">{formatNgn(ngnSpent)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Payments</p>
                      <p className="text-xl font-bold text-gray-900">{count}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Auto top-up ──────────────────────────────────────────────── */}
            {settings && (
              <AutoTopUpPanel
                settings={settings}
                saving={settingsSaving}
                onChange={handleSettingsChange}
              />
            )}

            {/* ── Transaction history ───────────────────────────────────────── */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Transaction History</h2>
                <button
                  onClick={refresh}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                >
                  Refresh
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-2xl mb-2">💸</p>
                  <p className="text-sm text-gray-500">No transactions yet</p>
                  <p className="text-xs text-gray-400 mt-1">Fund your wallet to get started</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {transactions.map(tx => (
                    <li key={tx.id} className="flex items-center gap-3 px-5 py-3.5">
                      {/* Direction icon */}
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                        tx.direction === 'in' ? 'bg-emerald-100' : 'bg-red-100'
                      }`}>
                        {tx.direction === 'in' ? '↓' : '↑'}
                      </div>

                      {/* Description + date */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(tx.createdAt)}</p>
                      </div>

                      {/* Type badge */}
                      <span className={`hidden sm:inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${TX_TYPE_COLOR[tx.type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {TX_TYPE_LABEL[tx.type] ?? tx.type}
                      </span>

                      {/* Amount */}
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold ${tx.direction === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {tx.direction === 'in' ? '+' : '-'}
                          {tx.currency === 'NGN' ? formatNgn(tx.amount) : formatUsd(tx.amount)}
                        </p>
                        <p className="text-xs text-gray-400">
                          bal: {tx.currency === 'NGN' ? formatNgn(tx.balanceAfter) : formatUsd(tx.balanceAfter)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>

      {/* ── Top-up modal ─────────────────────────────────────────────────────── */}
      {topUpOpen && (
        <TopUpModal
          onClose={() => setTopUpOpen(false)}
          onSubmit={handleTopUp}
        />
      )}
    </div>
  );
}
