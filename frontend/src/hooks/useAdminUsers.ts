import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { AdminUserDetail, UserRole } from '../../../src/shared/types';

interface AdminUsersResponse {
  users: AdminUserDetail[];
  total: number;
}

interface UseAdminUsersParams {
  search?: string;
  limit?: number;
  offset?: number;
}

interface UseAdminUsersResult {
  users: AdminUserDetail[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  suspend: (id: string) => Promise<void>;
  unsuspend: (id: string) => Promise<void>;
  changeRole: (id: string, role: UserRole) => Promise<void>;
  forceLogout: (id: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

export function useAdminUsers({
  search = '',
  limit = 20,
  offset = 0,
}: UseAdminUsersParams = {}): UseAdminUsersResult {
  const [users, setUsers] = useState<AdminUserDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const data = await api.get<AdminUsersResponse>(`/admin/users?${params.toString()}`);
      setUsers(data.users);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, limit, offset]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const suspend = useCallback(async (id: string) => {
    await api.post(`/admin/users/${id}/suspend`, {});
    await fetchUsers();
  }, [fetchUsers]);

  const unsuspend = useCallback(async (id: string) => {
    await api.post(`/admin/users/${id}/unsuspend`, {});
    await fetchUsers();
  }, [fetchUsers]);

  const changeRole = useCallback(async (id: string, role: UserRole) => {
    await api.patch(`/admin/users/${id}/role`, { role });
    await fetchUsers();
  }, [fetchUsers]);

  const forceLogout = useCallback(async (id: string) => {
    await api.post(`/admin/users/${id}/force-logout`, {});
    await fetchUsers();
  }, [fetchUsers]);

  const deleteUser = useCallback(async (id: string) => {
    await api.delete(`/admin/users/${id}`);
    await fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    total,
    loading,
    error,
    refetch: fetchUsers,
    suspend,
    unsuspend,
    changeRole,
    forceLogout,
    deleteUser,
  };
}
