import { useState } from 'react';
import { NavBar } from '../components/NavBar';
import { usePlans } from '../hooks/usePlans';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import type { Plan } from '../../../src/shared/types';

function priceLabel(p: Plan): string {
  if (p.priceMinor === 0) return 'Free';
  const amount = (p.priceMinor / 100).toLocaleString('en-US', {
    style: 'currency', currency: p.currency, minimumFractionDigits: 0,
  });
  return `${amount}/${p.interval === 'year' ? 'yr' : 'mo'}`;
}

export function PlansPage() {
  const { active } = useWorkspace();
  const audience = active?.type === 'business' ? 'business' : 'personal';
  const { plans, loading, error } = usePlans(audience);
  const toast = useToast();
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const currentPlan = active?.plan ?? 'free';

  async function upgrade(plan: Plan) {
    setUpgrading(plan.key);
    try {
      const { url } = await api.post<{ url: string }>('/billing/checkout', { planKey: plan.key });
      window.location.href = url; // hosted provider checkout
    } catch (err) {
      // 503 (billing not configured) surfaces as a friendly message here.
      toast.info(err instanceof Error ? err.message : 'Could not start checkout');
      setUpgrading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Plans &amp; pricing</h1>
        <p className="text-sm text-gray-500 mb-6">
          {audience === 'business'
            ? 'Plans for your business workspace.'
            : 'Plans for your personal workspace.'}
        </p>

        {loading ? (
          <p className="text-sm text-fg-subtle">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(p => {
              const isCurrent = p.key === currentPlan;
              const isPaid = p.priceMinor > 0;
              return (
                <div
                  key={p.key}
                  className={`rounded-2xl border bg-white p-5 shadow-sm flex flex-col ${
                    isCurrent ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-900">{p.displayName}</h2>
                    {isCurrent && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">Current</span>
                    )}
                  </div>
                  <p className="mt-1 text-2xl font-extrabold text-gray-900">{priceLabel(p)}</p>

                  <ul className="mt-4 space-y-1.5 flex-1">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    disabled={isCurrent || upgrading !== null || !isPaid}
                    onClick={() => isPaid && upgrade(p)}
                    className={`mt-5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      isCurrent
                        ? 'bg-gray-100 text-fg-subtle cursor-default'
                        : isPaid
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                          : 'border border-gray-300 text-fg-subtle cursor-default'
                    }`}
                  >
                    {isCurrent ? 'Current plan' : isPaid ? (upgrading === p.key ? 'Starting…' : `Upgrade to ${p.displayName}`) : 'Free'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-xs text-fg-subtle">
          Prices shown are introductory and may change. Billing is being rolled out — your current plan stays active.
        </p>
      </main>
    </div>
  );
}
