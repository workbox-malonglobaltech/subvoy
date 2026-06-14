import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { BillingUsageItem, BillingHistoryEntry } from '../../../src/shared/types';

export interface BillingStatus {
  workspaceId: string;
  plan: string;
  provider: string | null;
  status: 'inactive' | 'pending' | 'active' | 'canceled' | 'expired';
  currentPeriodEnd: string | null;
}

/** Current usage vs. effective limits for the active workspace. Refetches when
 *  `refreshKey` changes (e.g. after adding/removing an item) and on mount. */
export function useUsage(refreshKey: number = 0) {
  const [usage, setUsage] = useState<BillingUsageItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    setLoading(true);
    api.get<BillingUsageItem[]>('/billing/usage')
      .then(setUsage)
      .catch(() => setUsage(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refetch(); }, [refetch, refreshKey]);
  return { usage, loading, refetch };
}

export function useBillingStatus() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    setLoading(true);
    api.get<BillingStatus>('/billing/status')
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refetch(); }, [refetch]);
  return { status, loading, refetch };
}

export function useBillingHistory() {
  const [history, setHistory] = useState<BillingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<BillingHistoryEntry[]>('/billing/history')
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { history, loading };
}
