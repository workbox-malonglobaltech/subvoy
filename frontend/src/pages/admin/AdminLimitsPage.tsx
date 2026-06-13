import { useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAdminLimits, type WorkspaceOverride } from '../../hooks/useAdminLimits';
import { useToast } from '../../contexts/ToastContext';
import type { PlanLimit } from '../../../../src/shared/types';

const LIMIT_LABELS: Record<string, string> = {
  max_payment_obligations: 'Tracked payments / subscriptions',
  max_compliance_obligations: 'Compliance obligations',
  max_members: 'Team members',
};
const LIMIT_KEYS = Object.keys(LIMIT_LABELS);

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

function OverridesSection({ overrides, onSet, onClear }: {
  overrides: WorkspaceOverride[];
  onSet: (workspaceId: string, limitKey: string, value: number) => Promise<void>;
  onClear: (workspaceId: string, limitKey: string) => Promise<void>;
}) {
  const toast = useToast();
  const [wsId, setWsId] = useState('');
  const [key, setKey] = useState(LIMIT_KEYS[0]);
  const [value, setValue] = useState('');
  const [unlimited, setUnlimited] = useState(false);
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!wsId.trim()) { toast.error('Enter a workspace ID'); return; }
    setSaving(true);
    try {
      await onSet(wsId.trim(), key, unlimited ? -1 : Math.max(0, parseInt(value || '0', 10)));
      toast.success('Override set');
      setWsId(''); setValue(''); setUnlimited(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set override');
    } finally { setSaving(false); }
  }

  async function clear(workspaceId: string, limitKey: string) {
    try { await onClear(workspaceId, limitKey); toast.success('Override cleared'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to clear override'); }
  }

  return (
    <section className="bg-surface rounded-2xl border border-line p-5 shadow-card">
      <h2 className="text-sm font-semibold text-fg mb-1">Per-account overrides</h2>
      <p className="text-xs text-fg-subtle mb-4">
        Comps, enterprise deals, or support exceptions for a specific workspace — these win over the plan default.
      </p>

      <div className="flex flex-wrap items-end gap-2 mb-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-fg-subtle mb-1">Workspace ID</label>
          <input value={wsId} onChange={e => setWsId(e.target.value)} placeholder="workspace uuid"
            className="w-full rounded-lg border border-line px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="block text-xs text-fg-subtle mb-1">Limit</label>
          <select value={key} onChange={e => setKey(e.target.value)}
            className="rounded-lg border border-line px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
            {LIMIT_KEYS.map(k => <option key={k} value={k}>{LIMIT_LABELS[k] ?? k}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-xs text-fg-subtle">
          <input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-line text-primary focus:ring-primary/40" />
          Unlimited
        </label>
        <input type="number" min={0} value={unlimited ? '' : value} disabled={unlimited} onChange={e => setValue(e.target.value)}
          placeholder="value"
          className="w-20 rounded-lg border border-line px-2 py-1.5 text-right text-sm disabled:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <button onClick={add} disabled={saving}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:bg-primary-700 disabled:opacity-40 transition-colors">
          {saving ? '…' : 'Set'}
        </button>
      </div>

      {overrides.length === 0 ? (
        <p className="text-xs text-fg-subtle">No overrides set.</p>
      ) : (
        <ul className="divide-y divide-line">
          {overrides.map(o => (
            <li key={`${o.workspaceId}-${o.limitKey}`} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium text-fg">{o.workspaceName ?? o.workspaceId}</span>
                <span className="text-fg-subtle"> · {LIMIT_LABELS[o.limitKey] ?? o.limitKey} = {o.limitValue === -1 ? 'Unlimited' : o.limitValue}</span>
              </span>
              <button onClick={() => clear(o.workspaceId, o.limitKey)}
                className="shrink-0 text-xs font-medium text-error-600 transition-colors hover:text-error-700">Clear</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminLimitsPage() {
  const { limits, overrides, loading, error, updateLimit, setOverride, clearOverride } = useAdminLimits();
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
          <p className="text-sm text-fg-subtle">Loading…</p>
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

            <OverridesSection overrides={overrides} onSet={setOverride} onClear={clearOverride} />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
