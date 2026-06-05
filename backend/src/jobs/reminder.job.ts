import cron from 'node-cron';
import { runReminderScan } from '../services/reminder.service';

export function startReminderJob(): void {
  // Run daily at 8:00 AM in the configured timezone (defaults to UTC).
  // Set REMINDER_TIMEZONE in .env to match your user base, e.g. 'America/New_York'.
  const timezone = process.env.REMINDER_TIMEZONE ?? 'UTC';
  cron.schedule('0 8 * * *', async () => {
    try {
      await runReminderScan();
    } catch (err) {
      console.error('[Reminder] Job failed:', err);
    }
  }, { timezone });
  console.log(`[Reminder] Daily reminder job scheduled (8:00 AM ${timezone})`);
}
