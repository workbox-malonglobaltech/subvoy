/**
 * Sentry error monitoring. Enabled only when SENTRY_DSN is set — otherwise a
 * no-op (like the email service without a key). Import this early in index.ts.
 */
import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';
import path from 'path';

// Self-load env so DSN resolves regardless of module import order.
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const dsn = process.env.SENTRY_DSN;
export const sentryEnabled = Boolean(dsn && dsn !== 'your_sentry_dsn_here');

if (sentryEnabled) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0, // errors only for now; turn on tracing later
  });
  console.log('[sentry] error monitoring enabled');
}

/** Reports an exception to Sentry (no-op when disabled). */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!sentryEnabled) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
