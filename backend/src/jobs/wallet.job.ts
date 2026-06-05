import cron from 'node-cron';
import { runAutoTopUpScan } from '../services/wallet-autotopup.service';

export function startWalletJob(): void {
  const timezone = process.env.REMINDER_TIMEZONE ?? 'UTC';

  // Run every hour. The service itself deduplicates so multiple runs per day
  // are safe — threshold tops up at most once per 12h, scheduled once per month.
  cron.schedule('0 * * * *', async () => {
    try {
      await runAutoTopUpScan();
    } catch (err) {
      console.error('[AutoTopUp] Job failed:', err);
    }
  }, { timezone });

  console.log(`[AutoTopUp] Hourly auto top-up job scheduled (${timezone})`);
}
