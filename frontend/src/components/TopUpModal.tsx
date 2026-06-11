import { useState } from 'react';
import { api } from '../lib/api';
import type { WalletTopUpInput } from '../../../src/shared/types';
import { Modal } from './ui/Modal';

interface Props {
  onClose: () => void;
  onSubmit: (input: WalletTopUpInput) => Promise<void>;
}

// Detect if Paystack is configured in this environment.
// Set VITE_PAYSTACK_PUBLIC_KEY in your .env (not needed server-side — just for UI toggle).
const PAYSTACK_ENABLED = Boolean(import.meta.env.VITE_PAYSTACK_PUBLIC_KEY);

const MOCK_RATE = 1600; // ₦1,600 per $1 — kept in sync with backend

export function TopUpModal({ onClose, onSubmit }: Props) {
  // `amount` is entered in the SELECTED destination's currency: ₦ for NGN, $ for
  // USD. The wallet is funded via the naira rail (Paystack), so we always send the
  // naira charge to the backend — for USD we convert the entered dollars at the rate.
  const [amount, setAmount]               = useState('');
  const [destination, setDestination]     = useState<'ngn' | 'usd'>('usd');
  const [fundingSource, setFundingSource] = useState('GTBank');
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const isUsd = destination === 'usd';
  const parsed = parseFloat(amount) || 0;
  // The naira amount actually charged (USD entries convert at the mock rate).
  const chargeNgn = isUsd ? Math.round(parsed * MOCK_RATE) : parsed;
  const conversionNote = parsed > 0
    ? (isUsd
        ? `You'll be charged ≈ ₦${chargeNgn.toLocaleString()} at ₦${MOCK_RATE.toLocaleString()}/$`
        : `≈ $${(parsed / MOCK_RATE).toFixed(2)} USD at ₦${MOCK_RATE.toLocaleString()}/$`)
    : null;

  function validate(): string | null {
    if (!parsed || parsed <= 0) return 'Enter a valid amount';
    if (chargeNgn < 100) return isUsd ? 'Minimum top-up is about $1' : 'Minimum top-up is ₦100';
    if (chargeNgn > 10_000_000) return 'Amount is too large';
    return null;
  }

  // ── Paystack flow ──────────────────────────────────────────────────────────

  async function handlePaystack() {
    const v = validate();
    if (v) { setError(v); return; }

    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post<{ authorizationUrl: string; reference: string }>(
        '/wallet/topup/initiate',
        { amountNgn: chargeNgn, destination }
      );
      // Redirect to Paystack's hosted checkout page
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start payment');
      setSubmitting(false);
    }
  }

  // ── Mock flow (dev / no Paystack key) ─────────────────────────────────────

  async function handleMock(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ amountNgn: chargeNgn, destination, fundingSource });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Top-up failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Fund Wallet" className="max-w-md">
        <div className="space-y-5">

          {/* Destination toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
            <div className="grid grid-cols-2 gap-2">
              {(['usd', 'ngn'] as const).map(dest => (
                <button
                  key={dest}
                  type="button"
                  onClick={() => setDestination(dest)}
                  className={`rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors text-center ${
                    destination === dest
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="text-base">{dest === 'usd' ? '💳' : '🏦'}</div>
                  <div>{dest === 'usd' ? 'USD Card' : 'NGN Balance'}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {dest === 'usd' ? 'for subscriptions' : 'local payments'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Amount — entered in the selected destination's currency */}
          <div>
            <label htmlFor="topup-amount" className="block text-sm font-medium text-gray-700 mb-1">
              Amount ({isUsd ? '$' : '₦'})
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm">{isUsd ? '$' : '₦'}</span>
              <input
                id="topup-amount"
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={isUsd ? '50' : '5,000'}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-7 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {conversionNote && (
              <p className="mt-1.5 text-xs text-gray-500">{conversionNote}</p>
            )}
          </div>

          {/* Paystack mode */}
          {PAYSTACK_ENABLED ? (
            <>
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700 flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>
                  Pay securely with your card or bank transfer via Paystack.
                  Your naira lands in Subvoy instantly after payment.
                </span>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePaystack}
                  disabled={submitting || !parsed}
                  className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Redirecting…
                    </>
                  ) : (
                    <>
                      Pay{parsed > 0 ? ` ₦${chargeNgn.toLocaleString()}` : ''} with Paystack
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Mock / dev mode */
            <form onSubmit={handleMock} className="space-y-4">
              <div>
                <label htmlFor="topup-source" className="block text-sm font-medium text-gray-700 mb-1">
                  Funding Source
                </label>
                <select
                  id="topup-source"
                  value={fundingSource}
                  onChange={e => setFundingSource(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2.5 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {['GTBank','Access Bank','Zenith Bank','First Bank','UBA','Kuda','Opay','Other'].map(src => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-700 flex items-start gap-2">
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  <strong>Dev mode</strong> — no real money moves. Set <code>VITE_PAYSTACK_PUBLIC_KEY</code> to enable live payments.
                </span>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {submitting ? 'Processing…' : 'Simulate Top-up'}
                </button>
              </div>
            </form>
          )}

        </div>
    </Modal>
  );
}
