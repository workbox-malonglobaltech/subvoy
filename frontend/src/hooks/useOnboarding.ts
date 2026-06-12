import { useMemo } from 'react';
import { WALLET_ENABLED } from '../lib/features';

// ── localStorage keys ────────────────────────────────────────────────────────

const KEY_WELCOME_SEEN  = 'subvoy_onboarding_welcome_seen';
const KEY_REMINDERS_ACK = 'subvoy_onboarding_reminders_ack';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function markWelcomeSeen() {
  localStorage.setItem(KEY_WELCOME_SEEN, '1');
}

export function markRemindersAcknowledged() {
  localStorage.setItem(KEY_REMINDERS_ACK, '1');
}

export function isWelcomeSeen(): boolean {
  return localStorage.getItem(KEY_WELCOME_SEEN) === '1';
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  done: boolean;
  /** href to navigate to when the step is clicked (if not done) */
  href?: string;
  /** callback to call instead of navigating (e.g. open a modal) */
  action?: 'openAddModal';
}

interface Options {
  subscriptionCount: number;
  /** USD balance in whole dollars (as returned by API) */
  walletUsd: number;
  /** NGN balance in whole naira (as returned by API) */
  walletNgn: number;
  /** Pass true when wallet data is still loading so we don't flash the step as incomplete */
  walletLoading?: boolean;
}

export function useOnboarding({
  subscriptionCount,
  walletUsd,
  walletNgn,
  walletLoading = false,
}: Options) {
  const hasSubscription  = subscriptionCount > 0;
  const hasWalletFunds   = walletUsd > 0 || walletNgn > 0;
  const remindersAcked   = localStorage.getItem(KEY_REMINDERS_ACK) === '1';

  const steps: OnboardingStep[] = useMemo(() => [
    {
      id: 'account',
      label: 'Create your account',
      description: "You're in — welcome to Subvoy.",
      done: true,
    },
    {
      id: 'first-sub',
      label: 'Add your first subscription',
      description: 'Track Netflix, Spotify, AWS — anything that charges you regularly.',
      done: hasSubscription,
      action: 'openAddModal',
    },
    {
      id: 'reminders',
      label: 'Enable payment reminders',
      description: "Get email alerts 3 & 7 days before renewals — so you're never surprised.",
      done: remindersAcked,
      href: '/settings',
    },
    // Wallet funding is gated with the wallet feature.
    ...(WALLET_ENABLED ? [{
      id: 'wallet',
      label: 'Fund your wallet',
      description: 'Add USD funds to pay subscriptions directly — no more card declines.',
      done: walletLoading ? false : hasWalletFunds,
      href: '/wallet',
    } as OnboardingStep] : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [hasSubscription, remindersAcked, walletLoading, walletUsd, walletNgn]);

  const completedCount = steps.filter(s => s.done).length;
  const allDone        = completedCount === steps.length;
  const progress       = Math.round((completedCount / steps.length) * 100);

  return { steps, completedCount, allDone, progress };
}
