# Subvoy — Setup Runbook (dev → staging → production)

Canonical, step-by-step setup for all services, wired to the 3-environment model.
**[you]** = dashboard/CLI work · **[me]** = code already in the repo or to be done.

## Conventions
- **Branches → envs:** `dev` = local · `staging` = staging.subvoy.com · `main` = subvoy.com
- **Golden rule:** every service has its **own keys per env**; **live/prod keys live only in production.**
- **Secrets live in:** local `.env` (dev) · Fly secrets (backend staging/prod) · Vercel env groups (frontend) · GitHub Environments (CI/deploy).

| Branch | Env | Frontend (Vercel) | Backend (Fly) | DB/Auth (Supabase) |
|---|---|---|---|---|
| `dev` | development | localhost:5173 | localhost:3001 | local CLI (or staging) |
| `staging` | staging | staging.subvoy.com | api.staging.subvoy.com · `subvoy-api-staging` | `subvoy-staging` |
| `main` | production | subvoy.com | api.subvoy.com · `subvoy-api-prod` | `subvoy-prod` |

---

## Phase 1 — App secrets you generate
Run twice **per environment** and save:
```bash
openssl rand -hex 32   # -> JWT_SECRET
openssl rand -hex 32   # -> ENCRYPTION_KEY (must be 64 hex chars)
```

## Phase 2 — Supabase (DB + Auth)
- Free tier ≈ 2 active projects/org → **dev = local**, **staging + prod = hosted**.
- **Staging** project already created → rename `subvoy-staging`.
  1. Settings → Database → **Session pooler** URI → `DATABASE_URL` (insert DB password).
  2. Settings → API → copy `Project URL` (`VITE_SUPABASE_URL`), `anon` (`VITE_SUPABASE_ANON_KEY`), `service_role` (`SUPABASE_SERVICE_ROLE_KEY`), **JWT secret** (`SUPABASE_JWT_SECRET`).
  3. Auth → Providers → enable **Email**, **Google**, **Apple**; redirect URLs `https://staging.subvoy.com/**` + `http://localhost:5173/**`.
- **Production:** create `subvoy-prod`, repeat with prod URLs (at launch).
- **Dev:** `supabase init && supabase start` (local) or point at staging to begin.
- Security toggles (project creation): **Data API OFF · auto-expose OFF · automatic RLS ON** (we use Supabase behind the Express API, not via PostgREST).

## Phase 3 — Resend (email)
1. Domains → add `subvoy.com` → add DNS records in Cloudflare → verify (prod sender `no-reply@subvoy.com`).
2. API Keys → `subvoy-prod` + `subvoy-staging` → `RESEND_API_KEY` per env.
3. Staging/dev: send only to your own inbox (don't email real users).

## Phase 4 — Paystack (payments)
- Test mode keys (`sk_test_…` / `pk_test_…`) → **dev + staging**.
- Live mode keys (`sk_live_…` / `pk_live_…`) → **production only**.
- Webhooks: test → `https://api.staging.subvoy.com/webhook/paystack` (+ `/billing/webhook/paystack`); live → `https://api.subvoy.com/...`.

## Phase 5 — Backend on Fly.io
Repo already contains `Dockerfile`, `fly.staging.toml`, `fly.production.toml`, and a Fly deploy workflow.
```bash
# one-time
flyctl auth login
flyctl apps create subvoy-api-staging
flyctl apps create subvoy-api-prod

# set secrets (staging shown; repeat for -a subvoy-api-prod with prod/live values)
flyctl secrets set -a subvoy-api-staging \
  DATABASE_URL="…" JWT_SECRET="…" ENCRYPTION_KEY="…" SUPABASE_JWT_SECRET="…" \
  RESEND_API_KEY="…" PAYSTACK_SECRET_KEY="sk_test_…" SENTRY_DSN="…" \
  GOOGLE_CLIENT_ID="…" GOOGLE_CLIENT_SECRET="…" \
  FRONTEND_URL="https://staging.subvoy.com" \
  COOKIE_SAMESITE="none" COOKIE_SECURE="true" COOKIE_DOMAIN=".subvoy.com"

# first deploy (also runs migrations via release_command)
flyctl deploy --config fly.staging.toml
flyctl certs add -a subvoy-api-staging api.staging.subvoy.com
```
- Region `lhr` (London) — keep same as Supabase. `min_machines_running = 1` + `RUN_JOBS=true` so cron runs on one always-on machine.
- After secrets are set once, **pushes to `staging`/`main` auto-deploy** via `.github/workflows/deploy.yml` (needs `FLY_API_TOKEN` secret — `flyctl tokens create deploy`).

> After the Supabase auth cutover, the web app uses Supabase **bearer** tokens (not cookies), so the split-origin cookie/CSRF concern goes away. The `COOKIE_*` vars cover the interim cookie path.

## Phase 6 — Vercel (frontend)
1. Import the repo; root `frontend`; framework Vite.
2. Env vars per target:
   - **Production** (`main`): `VITE_API_URL=https://api.subvoy.com`, prod `VITE_SUPABASE_URL/ANON_KEY`, `VITE_PAYSTACK_PUBLIC_KEY=pk_live_…`
   - **Preview** (staging/dev): staging values + `pk_test_…`
3. Domains: `subvoy.com` → Production; assign `staging.subvoy.com` → the `staging` branch.

## Phase 7 — Cloudflare DNS
`subvoy.com`/`www` → Vercel · `staging` → Vercel (staging) · `api` → Fly `subvoy-api-prod` · `api.staging` → Fly `subvoy-api-staging` · Resend verification records.

## Phase 8 — GitHub Environments (CI/deploy)
Settings → Environments → `staging` + `production`, each holding `FLY_API_TOKEN` (and, for the real-DB CI job, a test `DATABASE_URL`). The deploy workflow no-ops until `FLY_API_TOKEN` is set.

## Phase 9 — Supabase Auth cutover **[me]**
Once staging `SUPABASE_JWT_SECRET` etc. exist: A4 user import, A5 endpoint cutover, A6 web `supabase-js`. (Foundation — JWT verify + migration bridge + dual-mode `authenticate` — already merged.)

## Phase 10 — Smoke test
Staging: register → login (email + Google) → add subscription → Paystack **test** top-up → reminder email to your inbox. Then production with **live** keys; promote `staging → main`.

---

### Env var reference
**Backend (Fly secrets):** `DATABASE_URL` `DB_SSL`(auto in prod) `JWT_SECRET` `ENCRYPTION_KEY` `SUPABASE_JWT_SECRET` `FRONTEND_URL` `RESEND_API_KEY` `PAYSTACK_SECRET_KEY` `STRIPE_SECRET_KEY` `STRIPE_WEBHOOK_SECRET` `SENTRY_DSN` `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` `RUN_JOBS` `COOKIE_SAMESITE` `COOKIE_SECURE` `COOKIE_DOMAIN`
**Frontend (Vercel):** `VITE_API_URL` `VITE_SUPABASE_URL` `VITE_SUPABASE_ANON_KEY` `VITE_PAYSTACK_PUBLIC_KEY`
