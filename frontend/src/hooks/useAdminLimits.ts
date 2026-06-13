import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { PlanLimit } from '../../../src/shared/types';

export interface WorkspaceOverride {
  workspaceId: string;
  workspaceName: string | null;
  limitKey: string;
  limitValue: number;
}

export function useAdminLimits() {
  const [limits, setLimits] = useState<PlanLimit[]>([]);
  const [overrides, setOverrides] = useState<WorkspaceOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [planData, overrideData] = await Promise.all([
        api.get<PlanLimit[]>('/admin/limits'),
        api.get<WorkspaceOverride[]>('/admin/limits/overrides'),
      ]);
      setLimits(planData);
      setOverrides(overrideData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load limits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateLimit = async (plan: string, limitKey: string, limitValue: number) => {
    await api.put('/admin/limits', { plan, limitKey, limitValue });
    setLimits(prev => prev.map(l =>
      l.plan === plan && l.limitKey === limitKey ? { ...l, limitValue } : l
    ));
  };

  const setOverride = async (workspaceId: string, limitKey: string, limitValue: number) => {
    await api.put('/admin/limits/overrides', { workspaceId, limitKey, limitValue });
    await fetchAll();
  };

  const clearOverride = async (workspaceId: string, limitKey: string) => {
    await api.delete(`/admin/limits/overrides/${workspaceId}/${encodeURIComponent(limitKey)}`);
    setOverrides(prev => prev.filter(o => !(o.workspaceId === workspaceId && o.limitKey === limitKey)));
  };

  return { limits, overrides, loading, error, updateLimit, setOverride, clearOverride, refetch: fetchAll };
}
