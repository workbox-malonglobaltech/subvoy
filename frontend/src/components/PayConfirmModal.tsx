import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface SubSummary {
  name: string;
  amount: number;
  currency: string;
  billingCycle: string;
}

interface Props {
  sub: SubSummary;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

function cycleLabel(billingCycle: string): string {
  if (billingCycle === 'weekly') return '/wk';
  if (billingCycle === 'monthly') return '/mo';
  if (billingCycle === 'yearly') return '/yr';
  return '';
}

function isInsufficientBalanceError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('insufficient') || lower.includes('balance');
}

export function PayConfirmModal({ sub, onConfirm, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const showFundWalletPrompt = error !== null && isInsufficientBalanceError(error);

  return (
    <Modal open onClose={onClose} title="Confirm payment" className="max-w-sm">
      <div className="space-y-4">
        {/* Subscription detail */}
        <div className="rounded-xl bg-surface-subtle border border-line px-4 py-4 space-y-1">
          <p className="text-body font-medium text-fg-subtle">Subscription</p>
          <p className="text-body-lg font-semibold text-fg">{sub.name}</p>
          <p className="text-h3 font-bold text-primary">
            {formatAmount(sub.amount, sub.currency)}
            <span className="text-body font-normal text-fg-subtle ml-1">
              {cycleLabel(sub.billingCycle)}
            </span>
          </p>
        </div>

        {/* Error area */}
        {error !== null && (
          <div role="alert" className="rounded-lg bg-error-50 border border-error-600/20 px-4 py-3 text-body text-error-700">
            {showFundWalletPrompt ? (
              <>
                <p className="font-medium">Your wallet balance is too low.</p>
                <p className="mt-1">
                  <Link to="/wallet" className="font-semibold underline hover:text-error-700/80 transition-colors" onClick={onClose}>
                    Fund wallet &rarr;
                  </Link>
                </p>
              </>
            ) : (
              <p>{error}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={handleConfirm} loading={loading}>
            {loading ? 'Processing…' : 'Confirm payment'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
