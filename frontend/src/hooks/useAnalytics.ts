import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

interface MonthData {
  month: string;   // 'YYYY-MM'
  total: number;
}

interface AnalyticsData {
  months: MonthData[];
}

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<AnalyticsData>('/analytics/monthly');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
