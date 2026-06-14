import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/Button';
import { useBillingStatus, useBillingHistory } from '../hooks/useBilling';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import type { BillingStatus } from '../hooks/useBilling';

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
}
function money(minor: number, currency: string): string {
  return (minor / 100).toLocaleString('en-US', { style: 'currency', currency });
}

const STATUS_PILL: Record<BillingStatus['status'], string> = {
  active:   'bg-green-100 text-green-700',
  canceled: 'bg-amber-100 text-amber-700',
  expired:  'bg-gray-100 text-gray-600',
  pending:  'bg-blue-100 text-blue-700',
  inactive: 'bg-gray-100 text-gray-600',
};

/** Settings card: current plan, status, renewal/expiry, payment history, cancel. */
export function PlanBillingSection() {
  const { active } = useWorkspace();
  const { status, refetch } = useBillingStatus();
  const { history } = useBillingHistory();
  const toast = useToast();
  const [canceling, setCanceling] = useState(false);

  const plan = status?.plan ?? active?.plan ?? 'free';
  const st = status?.status ?? 'inactive';
  const isOwnerAdmin = active?.role === 'owner' || active?.role === 'admin';

  async function cancel() {
    if (!window.confirm('Cancel your plan? You keep access until the current period ends.')) return;
    setCanceling(true);
    try {
      await api.post('/billing/cancel', {});
      toast.success('Plan canceled — active until the period ends');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel plan');
    } finally {
      setCanceling(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm" aria-labelledby="billing-heading">
      <h2 id="billing-heading" className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Plan &amp; billing</h2>

      <dl className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <dt className="text-gray-500">Current plan</dt>
          <dd className="font-medium text-gray-900 capitalize">{plan}</dd>
        </div>
        <div className="flex items-center justify-between text-sm">
          <dt className="text-gray-500">Status</dt>
          <dd>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_PILL[st]}`}>{st}</span>
          </dd>
        </div>
        {status?.currentPeriodEnd && (
          <div className="flex items-center justify-between text-sm">
            <dt className="text-gray-500">{st === 'canceled' ? 'Access until' : 'Renews / expires'}</dt>
            <dd className="font-medium text-gray-900">{fmtDate(status.currentPeriodEnd)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link to="/plans">
          <Button size="sm" variant="secondary">{plan === 'free' ? 'Upgrade' : 'Change plan'}</Button>
        </Link>
        {isOwnerAdmin && st === 'active' && (
          <Button size="sm" variant="ghost" loading={canceling} onClick={cancel}>Cancel plan</Button>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Billing history</p>
          <ul className="divide-y divide-gray-100" role="list">
            {history.map(h => (
              <li key={h.id} className="flex items-center justify-between py-2 text-sm first:pt-0 last:pb-0">
                <span className="text-gray-600">
                  {fmtDate(h.createdAt)} · <span className="capitalize">{h.plan}</span>
                </span>
                <span className="font-medium text-gray-900">{money(h.amountMinor, h.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
