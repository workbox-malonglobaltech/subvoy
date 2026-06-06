import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import {
  ComplianceItem,
  CreateComplianceItemInput,
  UpdateComplianceItemInput,
  ComplianceStatus,
} from '../../../src/shared/types';

export function useCompliance() {
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<ComplianceItem[]>('/compliance');
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load compliance items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const add = async (input: CreateComplianceItemInput) => {
    const item = await api.post<ComplianceItem>('/compliance', input);
    setItems(prev => [...prev, item]);
    return item;
  };

  const update = async (id: string, input: UpdateComplianceItemInput) => {
    const item = await api.put<ComplianceItem>(`/compliance/${id}`, input);
    setItems(prev => prev.map(i => (i.id === id ? item : i)));
    return item;
  };

  const remove = async (id: string) => {
    await api.delete(`/compliance/${id}`);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const setStatus = (id: string, status: ComplianceStatus) => update(id, { status });

  return { items, loading, error, add, update, remove, setStatus, refetch: fetchAll };
}
