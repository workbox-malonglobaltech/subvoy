import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { PlanLimit } from '../../../src/shared/types';

export function useAdminLimits() {
  const [limits, setLimits] = useState<PlanLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLimits = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<PlanLimit[]>('/admin/limits');
      setLimits(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load limits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLimits(); }, [fetchLimits]);

  const updateLimit = async (plan: string, limitKey: string, limitValue: number) => {
    await api.put('/admin/limits', { plan, limitKey, limitValue });
    setLimits(prev => prev.map(l =>
      l.plan === plan && l.limitKey === limitKey ? { ...l, limitValue } : l
    ));
  };

  return { limits, loading, error, updateLimit, refetch: fetchLimits };
}
