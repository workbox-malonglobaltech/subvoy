import { useState } from 'react';
import { Link } from 'react-router-dom';

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-confirm-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 id="pay-confirm-title" className="text-lg font-semibold text-gray-900">
            Confirm payment
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close dialog"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Subscription detail */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-4 space-y-1">
            <p className="text-sm font-medium text-gray-500">Subscription</p>
            <p className="text-base font-semibold text-gray-900">{sub.name}</p>
            <p className="text-xl font-bold text-indigo-600">
              {formatAmount(sub.amount, sub.currency)}
              <span className="text-sm font-normal text-gray-500 ml-1">
                {cycleLabel(sub.billingCycle)}
              </span>
            </p>
          </div>

          {/* Error area */}
          {error !== null && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {showFundWalletPrompt ? (
                <>
                  <p className="font-medium">Your wallet balance is too low.</p>
                  <p className="mt-1">
                    <Link
                      to="/wallet"
                      className="font-semibold underline hover:text-red-900 transition-colors"
                      onClick={onClose}
                    >
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
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {loading && (
                <span
                  className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
              )}
              {loading ? 'Processing…' : 'Confirm payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
