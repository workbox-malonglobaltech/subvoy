import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';
import { useToast } from '../../contexts/ToastContext';
import type { AdminNotification } from '../../../../src/shared/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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

export function AdminNotificationsPage() {
  const toast = useToast();
  const { notifications, unreadCount, loading, markRead, markAllRead } = useAdminNotifications();

  async function handleMarkRead(notif: AdminNotification) {
    if (notif.readAt) return;
    try {
      await markRead(notif.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark as read');
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllRead();
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark all read');
    }
  }

  return (
    <AdminLayout unreadCount={unreadCount}>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500 mt-1">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="animate-pulse space-y-2">
                  <div className="bg-gray-200 rounded h-4 w-24" />
                  <div className="bg-gray-200 rounded h-4 w-full" />
                  <div className="bg-gray-200 rounded h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="text-4xl mb-3" aria-hidden="true">🔔</div>
            <p className="text-fg-subtle text-sm">No notifications</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(notif => (
              <button
                key={notif.id}
                onClick={() => handleMarkRead(notif)}
                disabled={!!notif.readAt}
                className={`w-full text-left bg-white rounded-2xl border shadow-sm p-5 transition-all ${
                  notif.readAt
                    ? 'border-gray-200 opacity-70'
                    : 'border-indigo-200 hover:border-indigo-300 hover:shadow-md cursor-pointer'
                }`}
                aria-label={`Notification: ${notif.title}${notif.readAt ? ' (read)' : ' (unread — click to mark read)'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-2 shrink-0">
                    <SeverityBadge severity={notif.severity} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-gray-900 truncate">{notif.title}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-fg-subtle">{timeAgo(notif.createdAt)}</span>
                        {!notif.readAt && (
                          <span
                            className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
