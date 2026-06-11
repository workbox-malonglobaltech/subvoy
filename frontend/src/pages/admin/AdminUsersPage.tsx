import { useState, useEffect, useRef, useCallback } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Modal } from '../../components/ui/Modal';
import { useAdminUsers } from '../../hooks/useAdminUsers';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import type { AdminUserDetail, UserRole } from '../../../../src/shared/types';

const LIMIT = 20;

function RoleBadge({ role }: { role: UserRole }) {
  const map: Record<UserRole, string> = {
    user: 'bg-gray-100 text-gray-700',
    staff: 'bg-indigo-100 text-indigo-800',
    superadmin: 'bg-purple-100 text-purple-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[role]}`}>
      {role}
    </span>
  );
}

function StatusBadge({ suspended }: { suspended: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        suspended ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
      }`}
    >
      {suspended ? 'Suspended' : 'Active'}
    </span>
  );
}

function formatNgn(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

function formatUsd(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}

interface ChangeRoleModalProps {
  user: AdminUserDetail;
  onClose: () => void;
  onConfirm: (role: UserRole) => Promise<void>;
}

function ChangeRoleModal({ user, onClose, onConfirm }: ChangeRoleModalProps) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onConfirm(role);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Change Role" description={user.email} className="max-w-sm">
        <form onSubmit={handleSubmit}>
          <select
            value={role}
            onChange={e => setRole(e.target.value as UserRole)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            aria-label="Select role"
          >
            <option value="user">user</option>
            <option value="staff">staff</option>
            <option value="superadmin">superadmin</option>
          </select>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || role === user.role}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
    </Modal>
  );
}

interface DeleteConfirmProps {
  user: AdminUserDetail;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function DeleteConfirmModal({ user, onClose, onConfirm }: DeleteConfirmProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Delete user?" description={user.name ?? user.email} className="max-w-sm">
        <p className="text-sm text-red-600 mb-5">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
    </Modal>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="animate-pulse bg-gray-200 rounded h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const { unreadCount } = useAdminNotifications();

  const [rawSearch, setRawSearch] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [changeRoleTarget, setChangeRoleTarget] = useState<AdminUserDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserDetail | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((val: string) => {
    setRawSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val);
      setOffset(0);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const {
    users,
    total,
    loading,
    suspend,
    unsuspend,
    changeRole,
    forceLogout,
    deleteUser,
  } = useAdminUsers({ search, limit: LIMIT, offset });

  const isSuperAdmin = currentUser?.role === 'superadmin';
  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  async function handleSuspend(u: AdminUserDetail) {
    try {
      await suspend(u.id);
      toast.success(`${u.email} suspended`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to suspend user');
    }
  }

  async function handleUnsuspend(u: AdminUserDetail) {
    try {
      await unsuspend(u.id);
      toast.success(`${u.email} unsuspended`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unsuspend user');
    }
  }

  async function handleChangeRole(role: UserRole) {
    if (!changeRoleTarget) return;
    try {
      await changeRole(changeRoleTarget.id, role);
      toast.success(`${changeRoleTarget.email} role changed to ${role}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change role');
    }
  }

  async function handleForceLogout(u: AdminUserDetail) {
    try {
      await forceLogout(u.id);
      toast.success(`${u.email} logged out`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to force logout');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteUser(deleteTarget.id);
      toast.success(`${deleteTarget.email} deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user');
    }
  }

  return (
    <AdminLayout unreadCount={unreadCount}>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            <p className="text-sm text-gray-500 mt-1">
              {total > 0 ? `${total} users total` : 'Manage platform users'}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search by name or email…"
              value={rawSearch}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              aria-label="Search users"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Subs
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    NGN
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    USD
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Joined
                  </th>
                  {isSuperAdmin && (
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isSuperAdmin ? 8 : 7}
                      className="px-4 py-12 text-center text-fg-subtle text-sm"
                    >
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 truncate max-w-[160px]">
                            {u.name ?? '—'}
                          </p>
                          <p className="text-xs text-gray-500 truncate max-w-[160px]">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge suspended={!!u.suspendedAt} />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {u.subscriptionCount}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-mono text-xs">
                        {formatNgn(u.walletNgnBalance)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-mono text-xs">
                        {formatUsd(u.walletUsdBalance)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 text-xs whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {u.suspendedAt ? (
                              <button
                                onClick={() => handleUnsuspend(u)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                              >
                                Unsuspend
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSuspend(u)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
                              >
                                Suspend
                              </button>
                            )}
                            <button
                              onClick={() => setChangeRoleTarget(u)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                            >
                              Role
                            </button>
                            <button
                              onClick={() => handleForceLogout(u)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
                            >
                              Logout
                            </button>
                            <button
                              onClick={() => setDeleteTarget(u)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500">
                Page {currentPage} of {totalPages} &middot; {total} results
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
                  disabled={offset === 0}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(o => o + LIMIT)}
                  disabled={offset + LIMIT >= total}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {changeRoleTarget && (
        <ChangeRoleModal
          user={changeRoleTarget}
          onClose={() => setChangeRoleTarget(null)}
          onConfirm={handleChangeRole}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </AdminLayout>
  );
}
