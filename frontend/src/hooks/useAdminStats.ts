import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { AdminStats } from '../../../src/shared/types';

interface UseAdminStatsResult {
  stats: AdminStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAdminStats(): UseAdminStatsResult {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<AdminStats>('/admin/stats');
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
