import cron from 'node-cron';
import { runPlanExpiryScan } from '../services/plan-expiry.service';

export function startPlanExpiryJob(): void {
  // Daily at 00:30 in the configured timezone — revert plans whose paid period
  // has lapsed. Idempotent: a plan already free is untouched.
  const timezone = process.env.REMINDER_TIMEZONE ?? 'UTC';
  cron.schedule('30 0 * * *', async () => {
    try {
      await runPlanExpiryScan();
    } catch (err) {
      console.error('[PlanExpiry] Job failed:', err);
    }
  }, { timezone });
  console.log(`[PlanExpiry] Daily plan-expiry job scheduled (00:30 ${timezone})`);
}
