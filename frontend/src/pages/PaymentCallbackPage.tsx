import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Wallet } from '../../../src/shared/types';

type Status = 'verifying' | 'success' | 'already_credited' | 'failed' | 'error' | 'no_reference';

export function PaymentCallbackPage() {
  const [searchParams]  = useSearchParams();
  const reference       = searchParams.get('reference') ?? searchParams.get('trxref');

  const [status, setStatus]   = useState<Status>(reference ? 'verifying' : 'no_reference');
  const [wallet, setWallet]   = useState<Wallet | null>(null);
  const [errMsg, setErrMsg]   = useState<string | null>(null);

  useEffect(() => {
    if (!reference) return;

    api.get<{ wallet: Wallet; alreadyCredited: boolean }>(
      `/wallet/topup/verify/${encodeURIComponent(reference)}`
    )
      .then(data => {
        setWallet(data.wallet);
        setStatus(data.alreadyCredited ? 'already_credited' : 'success');
      })
      .catch(err => {
        const msg = err instanceof Error ? err.message : 'Verification failed';
        if (msg.toLowerCase().includes('abandoned') || msg.toLowerCase().includes('failed')) {
          setStatus('failed');
        } else {
          setStatus('error');
          setErrMsg(msg);
        }
      });
  }, [reference]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <div className="w-full max-w-sm">

        {status === 'verifying' && (
          <>
            <div className="w-14 h-14 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h1 className="text-xl font-bold text-gray-900">Confirming your payment…</h1>
            <p className="mt-2 text-sm text-gray-500">This usually takes just a second.</p>
          </>
        )}

        {(status === 'success' || status === 'already_credited') && (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {status === 'already_credited' ? 'Already credited' : 'Payment confirmed!'}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {status === 'already_credited'
                ? 'This payment was already processed — your wallet is up to date.'
                : 'Your wallet has been funded successfully.'}
            </p>

            {wallet && (
              <div className="mt-6 rounded-2xl bg-white border border-gray-200 p-5 shadow-sm text-left space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Updated balances</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">USD balance</span>
                  <span className="text-sm font-bold text-gray-900">
                    ${wallet.usdBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">NGN balance</span>
                  <span className="text-sm font-bold text-gray-900">
                    ₦{wallet.ngnBalance.toLocaleString('en-NG')}
                  </span>
                </div>
              </div>
            )}

            <Link
              to="/wallet"
              className="mt-6 inline-flex items-center justify-center gap-2 w-full bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Go to Wallet
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link to="/" className="mt-3 block text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Back to Dashboard
            </Link>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Payment not completed</h1>
            <p className="mt-2 text-sm text-gray-500">
              The payment was abandoned or declined. No money was taken from your account.
            </p>
            <Link
              to="/wallet"
              className="mt-6 inline-flex items-center justify-center gap-2 w-full bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Try again
            </Link>
            <Link to="/" className="mt-3 block text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Back to Dashboard
            </Link>
          </>
        )}

        {(status === 'error' || status === 'no_reference') && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-gray-500">
              {status === 'no_reference'
                ? 'No payment reference found in the URL.'
                : errMsg ?? 'We could not verify your payment. Please contact support if your bank was debited.'}
            </p>
            <Link
              to="/wallet"
              className="mt-6 inline-flex items-center justify-center gap-2 w-full bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Go to Wallet
            </Link>
          </>
        )}

      </div>
    </div>
  );
}
