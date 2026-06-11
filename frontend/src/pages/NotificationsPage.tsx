import { NavBar } from '../components/NavBar';
import { useNotifications } from '../hooks/useNotifications';

function notifIcon(type: string): string {
  switch (type) {
    case 'price_change':     return '💰';
    case 'budget_alert':     return '⚠️';
    case 'payment_reminder': return '🔔';
    case 'compliance_reminder': return '📋';
    case 'payment':
    case 'autopay':
    case 'auto_topup':       return '💳';
    default:                 return '🔔';
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationsPage() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 py-8 animate-page-enter">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500 mt-0.5">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-sm text-indigo-600 font-medium hover:text-indigo-800">
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16" role="status" aria-label="Loading notifications">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
            <p className="text-fg-subtle text-sm">No notifications yet</p>
          </div>
        ) : (
          <ul className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {notifications.map(n => (
              <li key={n.id}>
                <button
                  onClick={() => { if (!n.isRead) markRead(n.id); }}
                  className={`w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-indigo-50/60' : ''}`}
                >
                  <div className="flex gap-3 items-start">
                    <span className="mt-0.5 text-lg shrink-0" aria-hidden="true">{notifIcon(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{n.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                      <p className="text-xs text-fg-subtle mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <span className="mt-1 w-2 h-2 rounded-full bg-indigo-500 shrink-0" aria-label="unread" />}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
