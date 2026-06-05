import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface AppNotification {
  id: string;
  subscriptionId: string | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const data = await api.get<NotificationsResponse>('/notifications');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // silently fail — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const markRead = async (id: string) => {
    await api.put(`/notifications/${id}/read`, {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await api.put('/notifications/read-all', {});
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  return { notifications, unreadCount, loading, markRead, markAllRead, refetch: fetchAll };
}
