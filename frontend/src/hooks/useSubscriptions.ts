import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { Subscription, CreateSubscriptionInput, UpdateSubscriptionInput } from '../../../src/shared/types';

export function useSubscriptions(includeInactive = false) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const path = includeInactive ? '/subscriptions?includeInactive=true' : '/subscriptions';
      const data = await api.get<Subscription[]>(path);
      setSubscriptions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Stable identities (useCallback) so consumers can memoize children (e.g.
  // React.memo on SubscriptionCard) without callback props busting the memo.
  const add = useCallback(async (input: CreateSubscriptionInput) => {
    const sub = await api.post<Subscription>('/subscriptions', input);
    setSubscriptions(prev => [...prev, sub]);
    return sub;
  }, []);

  const update = useCallback(async (id: string, input: UpdateSubscriptionInput) => {
    const sub = await api.put<Subscription>(`/subscriptions/${id}`, input);
    setSubscriptions(prev => prev.map(s => s.id === id ? sub : s));
    return sub;
  }, []);

  const remove = useCallback(async (id: string) => {
    await api.delete(`/subscriptions/${id}`);
    setSubscriptions(prev => prev.filter(s => s.id !== id));
  }, []);

  const hardRemove = useCallback(async (id: string) => {
    await api.delete(`/subscriptions/${id}?hard=true`);
    setSubscriptions(prev => prev.filter(s => s.id !== id));
  }, []);

  const archive = useCallback(async (id: string) => {
    const sub = await api.put<Subscription>(`/subscriptions/${id}`, { isActive: false });
    setSubscriptions(prev => prev.map(s => s.id === id ? sub : s));
    return sub;
  }, []);

  const restore = useCallback(async (id: string) => {
    const sub = await api.put<Subscription>(`/subscriptions/${id}`, { isActive: true });
    setSubscriptions(prev => prev.map(s => s.id === id ? sub : s));
    return sub;
  }, []);

  const bulkDelete = useCallback(async (ids: string[]) => {
    await api.post('/subscriptions/bulk-delete', { ids });
    setSubscriptions(prev => prev.filter(s => !ids.includes(s.id)));
  }, []);

  // Non-custodial: record an external payment → advance the billing cycle.
  const markPaid = useCallback(async (id: string) => {
    const sub = await api.post<Subscription>(`/subscriptions/${id}/mark-paid`, {});
    setSubscriptions(prev => prev.map(s => s.id === id ? sub : s));
    return sub;
  }, []);

  return { subscriptions, loading, error, add, update, remove, hardRemove, archive, restore, bulkDelete, markPaid, refetch: fetchAll };
}
