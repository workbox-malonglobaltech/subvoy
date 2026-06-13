import cron from 'node-cron';
import { runReminderScan } from '../services/reminder.service';

export function startReminderJob(): void {
  // Runs hourly; the scan delivers each user's reminders at ~08:00 in THEIR own
  // timezone (users.timezone), falling back to REMINDER_TIMEZONE / UTC. Per-user
  // de-dupe (alreadyNotifiedToday) guarantees at most one reminder per item per day.
  cron.schedule('0 * * * *', async () => {
    try {
      await runReminderScan();
    } catch (err) {
      console.error('[Reminder] Job failed:', err);
    }
  }, { timezone: 'UTC' });
  console.log('[Reminder] Hourly reminder job scheduled (delivers at 08:00 local per user)');
}
