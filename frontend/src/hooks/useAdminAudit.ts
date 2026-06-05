import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { AuditLog } from '../../../src/shared/types';

interface AdminAuditResponse {
  logs: AuditLog[];
  total: number;
}

interface UseAdminAuditParams {
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
}

interface UseAdminAuditResult {
  logs: AuditLog[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAdminAudit({
  limit = 20,
  offset = 0,
  dateFrom,
  dateTo,
}: UseAdminAuditParams = {}): UseAdminAuditResult {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const data = await api.get<AdminAuditResponse>(`/admin/audit?${params.toString()}`);
      setLogs(data.logs);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [limit, offset, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return { logs, total, loading, error, refetch: fetchLogs };
}
