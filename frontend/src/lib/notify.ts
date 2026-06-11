/** Emoji icon for a notification type (shared by the bell + notifications page). */
export function notifIcon(type: string): string {
  switch (type) {
    case 'price_change':        return '💰';
    case 'budget_alert':        return '⚠️';
    case 'payment_reminder':    return '🔔';
    case 'compliance_reminder': return '📋';
    case 'payment':
    case 'autopay':
    case 'auto_topup':          return '💳';
    default:                    return '🔔';
  }
}
