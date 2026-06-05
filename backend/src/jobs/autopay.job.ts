import cron from 'node-cron';
import { runAutopayScan } from '../services/autopay.service';

export function startAutopayJob(): void {
  // Run daily at 9:00 AM in the configured timezone — an hour after reminders,
  // so the day's reminder has gone out before we charge. The scan is idempotent
  // per billing period, so an extra run never double-charges.
  const timezone = process.env.REMINDER_TIMEZONE ?? 'UTC';
  cron.schedule('0 9 * * *', async () => {
    try {
      await runAutopayScan();
    } catch (err) {
      console.error('[Autopay] Job failed:', err);
    }
  }, { timezone });
  console.log(`[Autopay] Daily autopay job scheduled (9:00 AM ${timezone})`);
}
