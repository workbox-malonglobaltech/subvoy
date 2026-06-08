/**
 * Structured error logging service.
 *
 * Replaces raw console.error() calls.  Every error is:
 *  1. Printed to console (always — keeps existing dev behaviour)
 *  2. Persisted to error_logs table (async fire-and-forget — never blocks the HTTP response)
 *
 * Also tracks a rolling in-memory 5-minute error count so the alert service can
 * trigger notifications without an extra DB query on every request.
 */

import { pool } from '../db';
import { captureException } from '../lib/sentry';
import { ErrorLogLevel } from '../../../src/shared/types';

// ── In-memory rolling window for alert threshold ──────────────────────────────

const ALERT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const recentErrorTimestamps: number[] = [];

function recordForAlert(): void {
  const now = Date.now();
  recentErrorTimestamps.push(now);
  // Purge timestamps older than the window
  while (recentErrorTimestamps.length > 0 && recentErrorTimestamps[0] < now - ALERT_WINDOW_MS) {
    recentErrorTimestamps.shift();
  }
}

/** Returns the count of errors logged in the last 5 minutes. */
export function recentErrorCount(): number {
  const now = Date.now();
  return recentErrorTimestamps.filter(t => t >= now - ALERT_WINDOW_MS).length;
}

// ── Core logging function ─────────────────────────────────────────────────────

export interface LogErrorOptions {
  level?: ErrorLogLevel;
  message: string;
  error?: unknown;        // Original Error object
  route?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  context?: Record<string, unknown>;
}

export async function logError(opts: LogErrorOptions): Promise<void> {
  const level = opts.level ?? 'error';
  const err = opts.error instanceof Error ? opts.error : undefined;
  const stack = err?.stack ?? null;
  const message = opts.message + (err ? `: ${err.message}` : '');

  // 1. Console output (synchronous — never lost)
  console.error(`[${level.toUpperCase()}]${opts.route ? ' ' + opts.route : ''} ${message}`, stack ?? '');

  // 2. Record in rolling window (for alert threshold) + report to Sentry
  if (level === 'error' || level === 'fatal') {
    recordForAlert();
    captureException(err ?? new Error(message), {
      route: opts.route, method: opts.method, statusCode: opts.statusCode, userId: opts.userId,
    });
  }

  // 3. Persist to DB — fire-and-forget so a DB slowdown never blocks responses.
  // Wrapped defensively: logging must NEVER throw, otherwise a failure here
  // could crash the very errorHandler that called us and swallow the real
  // HTTP response. Promise.resolve() tolerates pool.query throwing synchronously
  // or returning a non-thenable.
  try {
    Promise.resolve(
      pool.query(
        `INSERT INTO error_logs
           (level, message, stack, route, method, status_code, user_id, context)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          level,
          message,
          stack,
          opts.route ?? null,
          opts.method ?? null,
          opts.statusCode ?? null,
          opts.userId ?? null,
          opts.context ? JSON.stringify(opts.context) : null,
        ],
      ),
    ).catch(dbErr => {
      // If the DB write itself fails, fall back to console only
      console.error('[error-logger] Failed to persist error log:', dbErr);
    });
  } catch (dbErr) {
    console.error('[error-logger] Failed to persist error log:', dbErr);
  }
}

/** Convenience wrapper — logs at "warn" level. */
export function logWarn(opts: Omit<LogErrorOptions, 'level'>): void {
  logError({ ...opts, level: 'warn' }).catch(() => {/* already handled inside logError */});
}

/** Convenience wrapper — logs at "fatal" level. */
export function logFatal(opts: Omit<LogErrorOptions, 'level'>): void {
  logError({ ...opts, level: 'fatal' }).catch(() => {/* already handled inside logError */});
}
