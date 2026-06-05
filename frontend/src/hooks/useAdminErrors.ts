import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { ErrorLog } from '../../../src/shared/types';

interface AdminErrorsResponse {
  errors: ErrorLog[];
  total: number;
}

interface UseAdminErrorsParams {
  level?: string;
  resolved?: boolean;
  limit?: number;
  offset?: number;
}

interface UseAdminErrorsResult {
  errors: ErrorLog[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  resolve: (id: string) => Promise<void>;
}

export function useAdminErrors({
  level,
  resolved,
  limit = 20,
  offset = 0,
}: UseAdminErrorsParams = {}): UseAdminErrorsResult {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchErrors = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (level) params.set('level', level);
      if (resolved !== undefined) params.set('resolved', String(resolved));
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const data = await api.get<AdminErrorsResponse>(`/admin/errors?${params.toString()}`);
      setErrors(data.errors);
      setTotal(data.total);
      setFetchError(null);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load errors');
    } finally {
      setLoading(false);
    }
  }, [level, resolved, limit, offset]);

  useEffect(() => { fetchErrors(); }, [fetchErrors]);

  const resolve = useCallback(async (id: string) => {
    await api.post(`/admin/errors/${id}/resolve`, {});
    await fetchErrors();
  }, [fetchErrors]);

  return {
    errors,
    total,
    loading,
    error: fetchError,
    refetch: fetchErrors,
    resolve,
  };
}
