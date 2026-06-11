import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';

/**
 * Compact wallet balance card shown on the Dashboard.
 * Fetches its own data so DashboardPage stays uncluttered.
 */
export function WalletWidget() {
  const { wallet, loading, error } = useWallet();

  if (error) return null; // silent on dashboard — user can visit /wallet for details

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-base">💳</span>
          <span className="text-sm font-semibold text-gray-900">Wallet</span>
        </div>
        <Link
          to="/wallet"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          Manage →
        </Link>
      </div>

      {loading ? (
        <div className="px-5 py-4 flex gap-6">
          <div className="h-4 w-20 rounded bg-gray-100 animate-pulse" />
          <div className="h-4 w-20 rounded bg-gray-100 animate-pulse" />
        </div>
      ) : wallet ? (
        <div className="px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* USD balance */}
          <div>
            <p className="text-xs text-fg-subtle uppercase tracking-wide">USD Card</p>
            <p className="text-lg font-bold text-gray-900">
              ${wallet.usdBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="h-8 w-px bg-gray-100 hidden sm:block" />

          {/* NGN balance */}
          <div>
            <p className="text-xs text-fg-subtle uppercase tracking-wide">NGN Balance</p>
            <p className="text-lg font-bold text-gray-900">
              ₦{wallet.ngnBalance.toLocaleString('en-NG')}
            </p>
          </div>

          {/* Fund shortcut */}
          <Link
            to="/wallet"
            className="ml-auto rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            + Fund
          </Link>
        </div>
      ) : null}
    </div>
  );
}
