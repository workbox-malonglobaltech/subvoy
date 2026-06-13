import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Initialise error monitoring as early as possible (no-op without SENTRY_DSN).
import './lib/sentry';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import subscriptionsRouter from './routes/subscriptions';
import workspacesRouter from './routes/workspaces';
import complianceRouter from './routes/compliance';
import plansRouter from './routes/plans';
import invitesRouter from './routes/invites';
import billingRouter from './routes/billing';
import billingWebhookRouter from './routes/billing-webhook';
import notificationsRouter from './routes/notifications';
import importsRouter from './routes/imports';
import analyticsRouter from './routes/analytics';
import emailImportRouter from './routes/email-import';
import forgotPasswordRouter from './routes/forgot-password';
import categoriesRouter from './routes/categories';
import oauthRouter from './routes/oauth';
import fxRouter from './routes/fx';
import walletRouter from './routes/wallet';
import reportsRouter from './routes/reports';
import webhookRouter from './routes/webhook';
import adminRouter from './routes/admin';
import { startReminderJob } from './jobs/reminder.job';
import { startFxJob } from './jobs/fx.job';
import { startWalletJob } from './jobs/wallet.job';
import { startAutopayJob } from './jobs/autopay.job';
import { WALLET_ENABLED } from './config/features';
import geoRouter from './routes/geo';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(helmet());
// FRONTEND_URL may be a comma-separated allowlist (e.g. apex + www) so the API
// accepts requests from every origin the frontend is served on.
const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// ── Webhook routes must receive the RAW body for signature verification ───────
// Mount BEFORE express.json() so the Buffer is preserved.
// Paystack (wallet funding) webhook — gated with the wallet feature.
if (WALLET_ENABLED) {
  app.use('/webhook', express.raw({ type: 'application/json' }), webhookRouter);
}
app.use('/billing/webhook', express.raw({ type: 'application/json' }), billingWebhookRouter);

app.use(express.json());
app.use(cookieParser());

const isTest = process.env.NODE_ENV === 'test';

// Global limiter — applied to every route before specific ones
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute window
  max: 120,                   // 120 req/min per IP across all routes
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { success: false, data: null, error: 'Too many requests, please try again later.' },
});

// Strict limiter for SENSITIVE auth writes (brute-force protection on the legacy
// login/register/forgot/reset endpoints). Skips /auth/me and /auth/profile —
// those are session reads/updates the app hits on every page load + login, and
// throttling them at 10/15min logged real users out mid-session. They remain
// covered by the global limiter (120/min) and require a valid token anyway.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isTest
    || req.originalUrl.startsWith('/auth/me')
    || req.originalUrl.startsWith('/auth/profile'),
  message: { success: false, data: null, error: 'Too many requests, please try again later.' },
});

// Strict limiter for CSV imports (CPU-intensive endpoint)
const importLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 5,                     // 5 uploads/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { success: false, data: null, error: 'Import rate limit exceeded, please wait before uploading again.' },
});

app.use(globalLimiter);
app.use('/health', healthRouter);
app.use('/auth', authLimiter, authRouter);
app.use('/subscriptions', subscriptionsRouter);
app.use('/workspaces', workspacesRouter);
app.use('/compliance', complianceRouter);
app.use('/plans', plansRouter);
app.use('/invites', invitesRouter);
app.use('/billing', billingRouter);
app.use('/notifications', notificationsRouter);
app.use('/imports', importLimiter, importsRouter);
app.use('/analytics', analyticsRouter);
app.use('/email-import', emailImportRouter);
app.use('/auth', authLimiter, forgotPasswordRouter);
app.use('/categories', categoriesRouter);
app.use('/auth', oauthRouter);
app.use('/fx', fxRouter);
app.use('/geo', geoRouter);
if (WALLET_ENABLED) app.use('/wallet', walletRouter);
app.use('/reports', reportsRouter);
app.use('/admin', adminRouter);
app.use(errorHandler);

// Start background jobs and HTTP server (skip in test — each suite imports app directly)
if (!isTest) {
  // Cron runs IN-PROCESS, so with >1 instance every instance would fire the same
  // jobs (duplicate reminders/FX/charges). Gate behind RUN_JOBS so exactly ONE
  // instance (or a dedicated worker) runs them. Default 'true' preserves the
  // current single-instance behaviour.
  if (process.env.RUN_JOBS !== 'false') {
    startReminderJob();
    startFxJob();
    // Money-movement jobs only run when the wallet feature is enabled.
    if (WALLET_ENABLED) {
      startWalletJob();
      startAutopayJob();
    }
    console.log(`[jobs] background jobs started (RUN_JOBS)${WALLET_ENABLED ? '' : ' — wallet/autopay jobs gated off'}`);
  } else {
    console.log('[jobs] background jobs disabled on this instance (RUN_JOBS=false)');
  }
  app.listen(PORT, () => {
    console.log(`Subvoy backend running on port ${PORT}`);
  });
}

export default app;
