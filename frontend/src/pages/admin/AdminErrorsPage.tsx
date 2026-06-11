import { useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAdminErrors } from '../../hooks/useAdminErrors';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../lib/api';
import type { ErrorLog } from '../../../../src/shared/types';

const LIMIT = 20;

type LevelFilter = 'all' | 'warn' | 'error' | 'fatal';
type ResolvedFilter = 'unresolved' | 'resolved' | 'all';

function LevelBadge({ level }: { level: ErrorLog['level'] }) {
  const map: Record<ErrorLog['level'], string> = {
    warn: 'bg-amber-100 text-amber-800',
    error: 'bg-red-100 text-red-800',
    fatal: 'bg-red-200 text-red-900 ring-1 ring-red-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[level]}`}>
      {level}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="animate-pulse bg-gray-200 rounded h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AdminErrorsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { unreadCount } = useAdminNotifications();

  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [resolvedFilter, setResolvedFilter] = useState<ResolvedFilter>('unresolved');
  const [offset, setOffset] = useState(0);
  const [purgingConfirm, setPurgingConfirm] = useState(false);
  const [purging, setPurging] = useState(false);

  const resolvedParam =
    resolvedFilter === 'unresolved' ? false
    : resolvedFilter === 'resolved' ? true
    : undefined;

  const { errors, total, loading, resolve, refetch } = useAdminErrors({
    level: levelFilter === 'all' ? undefined : levelFilter,
    resolved: resolvedParam,
    limit: LIMIT,
    offset,
  });

  const isSuperAdmin = user?.role === 'superadmin';
  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  async function handleResolve(err: ErrorLog) {
    try {
      await resolve(err.id);
      toast.success('Error marked as resolved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to resolve error');
    }
  }

  async function handlePurge() {
    setPurging(true);
    try {
      await api.delete('/admin/errors/resolved');
      toast.success('Resolved errors purged');
      setPurgingConfirm(false);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to purge errors');
    } finally {
      setPurging(false);
    }
  }

  function changeFilter<T>(setter: (v: T) => void, value: T) {
    setter(value);
    setOffset(0);
  }

  return (
    <AdminLayout unreadCount={unreadCount}>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Error Logs</h1>
            <p className="text-sm text-gray-500 mt-1">
              {total > 0 ? `${total} errors` : 'No errors found'}
            </p>
          </div>
          {isSuperAdmin && (
            <button
              onClick={() => setPurgingConfirm(true)}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
            >
              Purge Resolved
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label htmlFor="level-filter" className="text-xs font-medium text-gray-600">
              Level
            </label>
            <select
              id="level-filter"
              value={levelFilter}
              onChange={e => changeFilter(setLevelFilter, e.target.value as LevelFilter)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="all">All levels</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="fatal">Fatal</option>
            </select>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            {(['unresolved', 'resolved', 'all'] as ResolvedFilter[]).map(val => (
              <button
                key={val}
                onClick={() => changeFilter(setResolvedFilter, val)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  resolvedFilter === val
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Level</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Message</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Route</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Resolved</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                ) : errors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-fg-subtle text-sm">
                      No errors found
                    </td>
                  </tr>
                ) : (
                  errors.map(err => (
                    <tr key={err.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <LevelBadge level={err.level} />
                      </td>
                      <td className="px-4 py-3 max-w-[240px]">
                        <span className="truncate block text-gray-700" title={err.message}>
                          {err.message.length > 80 ? err.message.slice(0, 80) + '…' : err.message}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {err.route ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {err.statusCode ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {timeAgo(err.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {err.resolvedAt ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!err.resolvedAt && (
                          <button
                            onClick={() => handleResolve(err)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

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

      {/* Purge confirm modal */}
      {purgingConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setPurgingConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="purge-dialog-title"
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 id="purge-dialog-title" className="font-semibold text-gray-900 mb-2">
              Purge resolved errors?
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              All resolved error logs will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPurgingConfirm(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePurge}
                disabled={purging}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {purging ? 'Purging…' : 'Purge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
