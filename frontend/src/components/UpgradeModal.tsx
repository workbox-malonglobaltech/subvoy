import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { usePlans } from '../hooks/usePlans';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import type { Plan } from '../../../src/shared/types';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  audience: 'personal' | 'business';
  /** Context line — e.g. the cap message that triggered the prompt. */
  reason?: string;
}

function priceLabel(p: Plan): string {
  const amount = (p.priceMinor / 100).toLocaleString('en-US', {
    style: 'currency', currency: p.currency, minimumFractionDigits: 0,
  });
  return `${amount}/${p.interval === 'year' ? 'yr' : 'mo'}`;
}

/** Inline upgrade prompt shown when a workspace hits a plan cap (or taps "Upgrade").
 *  Lists the paid plans for the workspace audience and starts hosted checkout. */
export function UpgradeModal({ open, onClose, audience, reason }: UpgradeModalProps) {
  const { plans, loading } = usePlans(audience);
  const toast = useToast();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const paid = plans.filter(p => p.priceMinor > 0);

  async function upgrade(plan: Plan) {
    setUpgrading(plan.key);
    try {
      const { url } = await api.post<{ url: string }>('/billing/checkout', { planKey: plan.key });
      window.location.href = url; // hosted provider checkout
    } catch (err) {
      // 503 (billing not configured) surfaces as a friendly message.
      toast.info(err instanceof Error ? err.message : 'Could not start checkout');
      setUpgrading(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Upgrade your plan" description={reason ?? 'Unlock more with a paid plan.'}>
      {loading ? (
        <div className="flex justify-center py-8" role="status" aria-label="Loading plans">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : paid.length === 0 ? (
        <p className="text-body text-fg-muted py-4">
          No paid plans are available right now. <Link to="/plans" onClick={onClose} className="text-primary font-medium hover:underline">See all plans</Link>.
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {paid.map(p => (
              <div key={p.key} className="rounded-xl border border-line p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-fg">{p.displayName} · {priceLabel(p)}</p>
                  <ul className="mt-1 space-y-0.5">
                    {p.features.slice(0, 3).map((f, i) => (
                      <li key={i} className="text-sm text-fg-muted">• {f}</li>
                    ))}
                  </ul>
                </div>
                <Button size="sm" loading={upgrading === p.key} onClick={() => upgrade(p)} className="shrink-0">
                  Upgrade
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link to="/plans" onClick={onClose} className="text-sm font-medium text-primary hover:underline">
              Compare all plans
            </Link>
          </div>
        </>
      )}
    </Modal>
  );
}
