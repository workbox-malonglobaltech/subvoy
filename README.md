# Subvoy

Subscription aggregation and payment management. Track all your subscriptions in one
place, get reminders before payments are due, and pay them automatically from a wallet.

- **Domain**: subvoy.com
- **Stack**: React 18 + Vite + Tailwind (frontend) · Node + Express + PostgreSQL (backend) · npm workspaces monorepo
- **Testing**: Jest (unit/integration), Cypress (E2E)

---

## Getting started

```bash
npm install            # install all workspaces
cp .env.example .env   # then fill in the values (see below)
npm run db:migrate     # run database migrations
npm run dev            # start frontend + backend concurrently
```

> Requires Node 18+ and a running PostgreSQL instance.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run frontend + backend together |
| `npm run dev:frontend` / `npm run dev:backend` | Run one side only |
| `npm run build` | Production build (frontend + backend) |
| `npm test` | Backend unit/integration tests |
| `npm run test:e2e` | Cypress E2E (headless) |
| `npm run lint` / `npm run lint:fix` | Lint all workspaces |
| `npm run db:migrate` | Apply SQL migrations |

## Environment

Copy `.env.example` to `.env` and fill in:

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET`, `ENCRYPTION_KEY` | Auth signing + at-rest encryption |
| `FRONTEND_URL`, `OAUTH_REDIRECT_BASE_URL` | App URLs for CORS + OAuth callbacks |
| `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET` | OAuth + email import |
| `PAYSTACK_SECRET_KEY` | Wallet top-ups & payments |
| `FX_API_KEY`, `MOCK_NGN_USD_RATE` | Currency conversion |
| `SMTP_*`, `SMTP_FROM` | Outbound email (reminders, receipts) |
| `SENTRY_DSN` | Error monitoring |
| `REMINDER_TIMEZONE`, `WALLET_TOPUP_CRON` | Scheduled jobs |

**Never commit `.env`** — it is gitignored.

## Project structure

```
frontend/   React app (components, pages, hooks, contexts)
backend/    Express API (routes, services, models, jobs, db/migrations)
src/shared/ Types shared across frontend + backend
cypress/    E2E tests
brand/      Brand assets + guide
```

## Branching model

- `main` — production (protected; deploys to prod)
- `staging` — pre-prod integration / QA
- `dev` — active development; feature branches merge here first

Flow: `feature/*` → `dev` → `staging` → `main`.
