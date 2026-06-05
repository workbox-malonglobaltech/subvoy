import { useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAdminAudit } from '../../hooks/useAdminAudit';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';
import type { AuditLog } from '../../../../src/shared/types';

const LIMIT = 20;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function JsonBadge({ data }: { data: AuditLog['details'] }) {
  if (!data || Object.keys(data).length === 0) {
    return <span className="text-gray-400">—</span>;
  }

  const preview = JSON.stringify(data);
  const short = preview.length > 40 ? preview.slice(0, 40) + '…' : preview;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono bg-gray-100 text-gray-700 cursor-default"
      title={JSON.stringify(data, null, 2)}
    >
      {short}
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

export function AdminAuditPage() {
  const { unreadCount } = useAdminNotifications();

  const [offset, setOffset] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState<string | undefined>(undefined);
  const [appliedTo, setAppliedTo] = useState<string | undefined>(undefined);

  const { logs, total, loading } = useAdminAudit({
    limit: LIMIT,
    offset,
    dateFrom: appliedFrom,
    dateTo: appliedTo,
  });

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  function applyFilters() {
    setAppliedFrom(dateFrom || undefined);
    setAppliedTo(dateTo || undefined);
    setOffset(0);
  }

  function clearFilters() {
    setDateFrom('');
    setDateTo('');
    setAppliedFrom(undefined);
    setAppliedTo(undefined);
    setOffset(0);
  }

  return (
    <AdminLayout unreadCount={unreadCount}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total > 0 ? `${total} log entries` : 'Record of all admin actions'}
          </p>
        </div>

        {/* Date range filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="date-from" className="block text-xs font-medium text-gray-600 mb-1">
              From
            </label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
          <div>
            <label htmlFor="date-to" className="block text-xs font-medium text-gray-600 mb-1">
              To
            </label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
          <button
            onClick={applyFilters}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Apply
          </button>
          {(appliedFrom || appliedTo) && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Admin
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Target
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Details
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    IP
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                      No audit log entries found
                    </td>
                  </tr>
                ) : (
                  logs.map((log: AuditLog) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-700 font-mono text-xs truncate max-w-[140px]">
                        {log.adminEmail ?? log.adminId}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {log.targetType && log.targetId
                          ? `${log.targetType}:${log.targetId.slice(0, 8)}`
                          : log.targetType ?? '—'}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <JsonBadge data={log.details} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {log.ipAddress ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400 whitespace-nowrap">
                        <span title={new Date(log.createdAt).toLocaleString()}>
                          {timeAgo(log.createdAt)}
                        </span>
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
                Page {currentPage} of {totalPages} &middot; {total} entries
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
    </AdminLayout>
  );
}
