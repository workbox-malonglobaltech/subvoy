import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export interface CurrencyTotal {
  currency: string;
  monthlySpend: number;
  yearlySpend: number;
  count: number;
}

export interface Summary {
  /** Native per-currency totals — summed independently, never converted. */
  byCurrency: CurrencyTotal[];
  activeCount: number;
  due7Days: number;
  due30Days: number;
  byCategory: { category: string; currency: string; total: number }[];
}

export function useSummary(deps: unknown[] = []) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Summary>('/subscriptions/summary')
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { summary, loading };
}
