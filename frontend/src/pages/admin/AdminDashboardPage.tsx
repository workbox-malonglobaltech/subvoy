import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAdminStats } from '../../hooks/useAdminStats';
import { useAdminErrors } from '../../hooks/useAdminErrors';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';
import type { ErrorLog, AdminNotification } from '../../../../src/shared/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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

function SeverityBadge({ severity }: { severity: AdminNotification['severity'] }) {
  const map: Record<AdminNotification['severity'], string> = {
    info: 'bg-blue-100 text-blue-800',
    warning: 'bg-amber-100 text-amber-800',
    critical: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[severity]}`}>
      {severity}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight,
  loading,
}: {
  label: string;
  value: number | null;
  icon: string;
  highlight?: boolean;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <span className="text-xl" aria-hidden="true">{icon}</span>
      </div>
      {loading ? (
        <div className="animate-pulse bg-gray-200 rounded h-8 w-20" />
      ) : (
        <p className={`text-3xl font-bold ${highlight && (value ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
          {value ?? 0}
        </p>
      )}
    </div>
  );
}

export function AdminDashboardPage() {
  const { stats, loading: statsLoading } = useAdminStats();
  const { errors, loading: errorsLoading } = useAdminErrors({ limit: 5, resolved: false });
  const { notifications, unreadCount, loading: notifsLoading } = useAdminNotifications();

  const unreadNotifs = notifications.filter(n => !n.readAt).slice(0, 5);

  return (
    <AdminLayout unreadCount={unreadCount}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Platform health at a glance</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            value={stats?.totalUsers ?? null}
            icon="👤"
            loading={statsLoading}
          />
          <StatCard
            label="Active Subscriptions"
            value={stats?.activeSubscriptions ?? null}
            icon="📋"
            loading={statsLoading}
          />
          <StatCard
            label="New Users (7d)"
            value={stats?.newUsersLast7Days ?? null}
            icon="📈"
            loading={statsLoading}
          />
          <StatCard
            label="Errors (24h)"
            value={stats?.errorsLast24h ?? null}
            icon="🔴"
            highlight
            loading={statsLoading}
          />
        </div>

        {/* Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Errors */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Recent Errors</h2>
              <Link
                to="/admin/errors"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                View all →
              </Link>
            </div>

            {errorsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-gray-200 rounded h-8 w-full" />
                ))}
              </div>
            ) : errors.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400">No unresolved errors</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-2 font-medium">Level</th>
                      <th className="pb-2 font-medium">Message</th>
                      <th className="pb-2 font-medium">Route</th>
                      <th className="pb-2 font-medium text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {errors.map(err => (
                      <tr key={err.id} className="group hover:bg-gray-50">
                        <td className="py-2 pr-2">
                          <LevelBadge level={err.level} />
                        </td>
                        <td className="py-2 pr-2 max-w-[160px]">
                          <span className="truncate block text-gray-700" title={err.message}>
                            {err.message.length > 50
                              ? err.message.slice(0, 50) + '…'
                              : err.message}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-gray-500 font-mono">
                          {err.route ? err.route.slice(0, 20) : '—'}
                        </td>
                        <td className="py-2 text-right text-gray-400 whitespace-nowrap">
                          {timeAgo(err.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Unread Alerts */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Unread Alerts</h2>
              <Link
                to="/admin/notifications"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                View all →
              </Link>
            </div>

            {notifsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-gray-200 rounded h-8 w-full" />
                ))}
              </div>
            ) : unreadNotifs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400">No unread alerts</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unreadNotifs.map(notif => (
                  <div
                    key={notif.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <SeverityBadge severity={notif.severity} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{notif.title}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                      {timeAgo(notif.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
