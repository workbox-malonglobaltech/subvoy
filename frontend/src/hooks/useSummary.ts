import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export interface Summary {
  monthlySpend: number;
  yearlySpend: number;
  activeCount: number;
  due7Days: number;
  due30Days: number;
  byCategory: { category: string; total: number }[];
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
