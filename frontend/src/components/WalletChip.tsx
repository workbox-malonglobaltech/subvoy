import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';

/**
 * Compact wallet summary for the dashboard header — shows balances and links to
 * the full Wallet page (where funding/management lives). Keeps the dashboard body
 * free for the subscription list.
 */
export function WalletChip() {
  const { wallet, loading, error } = useWallet();
  if (error) return null;

  return (
    <Link
      to="/wallet"
      aria-label="Wallet — view balances and fund"
      title="Manage wallet"
      className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 shadow-card transition-colors hover:border-primary/40"
    >
      <span className="text-base" aria-hidden="true">💳</span>
      {loading ? (
        <span className="h-4 w-28 rounded bg-surface-muted animate-pulse" />
      ) : wallet ? (
        <span className="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-fg">
          <span>₦{wallet.ngnBalance.toLocaleString('en-NG')}</span>
          <span className="font-normal text-fg-subtle">·</span>
          <span>${wallet.usdBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </span>
      ) : null}
    </Link>
  );
}
