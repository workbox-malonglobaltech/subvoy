import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const start = Date.now();

  // Check DB connectivity with a lightweight query
  let dbStatus: 'ok' | 'error' = 'ok';
  let dbLatencyMs: number | null = null;
  let dbError: string | null = null;

  try {
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    dbLatencyMs = Date.now() - dbStart;
  } catch (err) {
    dbStatus = 'error';
    dbError = err instanceof Error ? err.message : 'Unknown database error';
  }

  const totalMs = Date.now() - start;
  const healthy = dbStatus === 'ok';

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      status: healthy ? 'ok' : 'degraded',
      version: process.env.npm_package_version ?? '1.0.0',
      environment: process.env.NODE_ENV ?? 'development',
      uptime: Math.floor(process.uptime()),
      responseTimeMs: totalMs,
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          ...(dbError ? { error: dbError } : {}),
        },
      },
    },
    error: healthy ? null : 'One or more health checks failed',
  });
});

export default router;
