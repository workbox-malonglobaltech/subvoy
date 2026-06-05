import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { AdminNotification } from '../../../src/shared/types';

interface AdminNotificationsResponse {
  notifications: AdminNotification[];
  total: number;
  unreadCount: number;
}

interface UseAdminNotificationsResult {
  notifications: AdminNotification[];
  total: number;
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useAdminNotifications(): UseAdminNotificationsResult {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<AdminNotificationsResponse>('/admin/notifications');
      setNotifications(data.notifications);
      setTotal(data.total);
      setUnreadCount(data.unreadCount);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    await api.post(`/admin/notifications/${id}/read`, {});
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await api.post('/admin/notifications/read-all', {});
    const now = new Date().toISOString();
    setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? now })));
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    total,
    unreadCount,
    loading,
    error,
    refetch: fetchNotifications,
    markRead,
    markAllRead,
  };
}
