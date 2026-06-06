import { useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAdminLimits } from '../../hooks/useAdminLimits';
import { useToast } from '../../contexts/ToastContext';
import type { PlanLimit } from '../../../../src/shared/types';

const LIMIT_LABELS: Record<string, string> = {
  max_payment_obligations: 'Tracked payments / subscriptions',
  max_compliance_obligations: 'Compliance obligations',
  max_members: 'Team members',
};

function LimitRow({ limit, onSave }: { limit: PlanLimit; onSave: (value: number) => Promise<void> }) {
  const unlimited = limit.limitValue === -1;
  const [value, setValue] = useState<string>(unlimited ? '' : String(limit.limitValue));
  const [isUnlimited, setIsUnlimited] = useState(unlimited);
  const [saving, setSaving] = useState(false);

  const dirty = isUnlimited !== unlimited || (!isUnlimited && value !== String(limit.limitValue));

  async function save() {
    setSaving(true);
    try {
      await onSave(isUnlimited ? -1 : Math.max(0, parseInt(value || '0', 10)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex-1 text-sm text-gray-700">{LIMIT_LABELS[limit.limitKey] ?? limit.limitKey}</span>
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        <input type="checkbox" checked={isUnlimited} onChange={e => setIsUnlimited(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
        Unlimited
      </label>
      <input
        type="number" min={0} value={isUnlimited ? '' : value} disabled={isUnlimited}
        onChange={e => setValue(e.target.value)}
        className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
      />
      <button
        onClick={save} disabled={!dirty || saving}
        className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
      >
        {saving ? '…' : 'Save'}
      </button>
    </div>
  );
}

export function AdminLimitsPage() {
  const { limits, loading, error, updateLimit } = useAdminLimits();
  const toast = useToast();

  const byPlan = limits.reduce<Record<string, PlanLimit[]>>((acc, l) => {
    (acc[l.plan] ??= []).push(l);
    return acc;
  }, {});

  async function handleSave(plan: string, limitKey: string, value: number) {
    try {
      await updateLimit(plan, limitKey, value);
      toast.success('Limit updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update limit');
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Plan Limits</h1>
        <p className="text-sm text-gray-500 mb-6">
          Tune what each plan allows. Changes take effect immediately. “Unlimited” = no cap.
        </p>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(byPlan).map(([plan, planLimits]) => (
              <section key={plan} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-800 capitalize mb-1">{plan} plan</h2>
                <div className="divide-y divide-gray-100">
                  {planLimits.map(l => (
                    <LimitRow key={l.limitKey} limit={l} onSave={(v) => handleSave(plan, l.limitKey, v)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
