import cron from 'node-cron';
import { fetchAndStoreRates } from '../services/fx.service';

export function startFxJob(): void {
  const timezone = process.env.REMINDER_TIMEZONE ?? 'UTC';

  // Run daily at midnight to have fresh rates ready for the day
  cron.schedule('0 0 * * *', async () => {
    try {
      await fetchAndStoreRates();
    } catch (err) {
      console.error('[FX] Daily rate fetch failed:', err);
      // Non-fatal — the app will use the last cached rate
    }
  }, { timezone });

  console.log(`[FX] Daily rate fetch job scheduled (00:00 ${timezone})`);

  // Fetch immediately on startup if no rates are cached yet
  fetchAndStoreRates().catch(err => {
    console.warn('[FX] Startup rate fetch failed — will use defaults or retry at midnight:', err);
  });
}
