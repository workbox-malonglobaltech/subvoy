# Project Memory — Claude Dev Team
<!-- 
  This file is loaded automatically at the start of every Claude Code session.
  Edit it to match your project. Keep it under 200 lines for best results.
  Use @path/to/file to import additional context files.
-->

## About This Project
- **Project Name**: Subvoy
- **Description**: A subscription aggregation and payment management platform. Users can track all their subscriptions/recurring payments in one place, get reminders before payments are due, and (later) automate payments on their behalf.
- **Domain**: subvoy.com
- **Owner**: [Your name / team name]
- **Started**: 2026-04-13

---

## Tech Stack
<!-- Update these to match your actual stack -->
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + PostgreSQL
- **Testing**: Jest (unit/integration), Cypress (E2E)
- **Build Tool**: Vite
- **Package Manager**: npm
- **Version Control**: Git

---

## Key Commands
```bash
npm install          # Install all dependencies
npm run dev          # Start development server
npm test             # Run all tests
npm run lint         # Check code style
npm run lint:fix     # Auto-fix style issues
npm run build        # Production build
npm run db:migrate   # Run database migrations
```

---

## Project Structure
```
src/
├── frontend/
│   ├── components/    # Reusable UI components
│   ├── pages/         # Page-level components
│   ├── hooks/         # Custom React hooks
│   └── types/         # TypeScript interfaces
├── backend/
│   ├── routes/        # API route handlers
│   ├── middleware/     # Auth, error handling, CORS
│   ├── services/      # Business logic
│   └── db/            # Models + migrations
└── shared/            # Types and utils used by both
```

---

## Code Standards

### Naming
- Variables & functions → `camelCase`
- React components & classes → `PascalCase`
- Constants → `UPPER_SNAKE_CASE`
- Files → `kebab-case.ts` (except components: `ComponentName.tsx`)

### TypeScript
- Always define interfaces for component props
- Avoid `any` — use `unknown` and narrow it
- Export all types from `src/shared/types/index.ts`

### API Design
- All responses follow this envelope:
  ```json
  { "success": true, "data": {}, "error": null }
  ```
- HTTP status codes must be semantically correct (200, 201, 400, 401, 403, 404, 500)
- Route naming: plural nouns (`/users`, `/posts`), not verbs

### Database
- **Always** use parameterized queries — never string interpolation
- Every table needs `created_at` and `updated_at` timestamps
- Schema changes via migration files only — never ALTER directly

### Error Handling
- Wrap all async functions in try/catch
- Log errors with context (what failed, with what input)
- Never expose stack traces to API consumers

---

## Security Rules (Non-Negotiable)
- Never commit `.env`, secrets, API keys, or passwords
- HttpOnly cookies for session tokens — never localStorage
- Validate and sanitize ALL user input before use
- Rate limiting on all public API endpoints
- `npm audit` must pass before any release

---

## Git Workflow
- Branch naming: `feature/short-description`, `fix/issue-description`
- Commit format: `type(scope): description`
  - Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
  - Example: `feat(auth): add Google OAuth2 login`
- Pull Request required before merging to main
- Squash commits on merge

---

## Team Roles (Slash Commands)
| Command | Role | Use For |
|---------|------|---------|
| `/planning` | Project Manager | Feature breakdown, sprint planning, estimates |
| `/frontend` | Senior Frontend Dev | React components, UI, state, accessibility |
| `/backend` | Senior Backend Dev | APIs, database, auth, server logic |
| `/code-review` | Code Reviewer | PR reviews, correctness, standards |
| `/security-review` | Security Architect | Vulnerability audits, auth checks |
| `/memory` | Memory Keeper | Update this file, capture learnings |

---

## Decisions Log
- [2026-04-13] Product named **Subvoy** (subvoy.com) — Previous working name was "Subbplus". Chosen for being short, brandable, and having .com available. Evokes "envoy" — a trusted agent managing your subscriptions.
- [2026-04-13] Stack: React 18 + Vite + Tailwind (frontend), Node/Express + PostgreSQL (backend), npm workspaces monorepo — Standard modern full-stack setup, workspaces for clean separation with shared types.
- [2026-04-13] MVP scope: Manual subscription tracking + dashboard + email reminders. Auto-detection (bank/email import) and payment automation are P1/P2 — Validate core value before building complex integrations.
- [2026-06-05] **Version control**: created a dedicated git repo for Subvoy pushed to `github.com/workbox-malonglobaltech/subvoy`, with a 3-branch model — `main` (production), `staging` (pre-prod/QA), `dev` (active development); flow is `feature/*` → dev → staging → main. Previously the code was untracked inside the home-directory git repo (whose remote was the unrelated Invoiccy project) — months of work had no history or backup.
- [2026-06-05] **Autopay** shipped: per-subscription opt-in (`subscriptions.autopay` + optional `autopay_max_amount` cap) with a global UI default (`wallet_settings.autopay_default`). A daily job (9am) charges every due subscription from the wallet via a shared transactional payment service (`backend/src/services/payment.service.ts`) that locks the subscription + wallet rows and is idempotent per billing period. **Wallet-funded only** (no card-on-file) to keep consent simple and avoid card-storage compliance scope. Insufficient balance notifies the user once/day and defers to the next run (auto-top-up aware).
- [2026-06-05] **CI/Deploy**: GitHub Actions CI (`.github/workflows/ci.yml`) runs typecheck + test + build on push/PR to dev/staging/main. Deploy (`deploy.yml`) is SSH+PM2, environment-scoped (staging/production), runs `db:migrate` on release, and no-ops until per-environment secrets are added.

---

## Known Issues / Tech Debt
<!-- Track things that need fixing later -->
- [ ] **Lint is non-functional**: `frontend`/`backend` `lint` scripts reference ESLint, but ESLint is not installed and there is no config — `npm run lint` fails. Either add `eslint` + a flat config (and wire it into CI as a blocking gate) or drop the scripts. CI currently relies on `tsc --noEmit` + tests + build instead.
- [ ] **Wallet balances display-rounded to whole units**: `toWallet()` does `Math.round(Number(balance)/100)`, so fractional dollars/naira are not shown (e.g. $9.99 → $10). Charging itself is exact (cents/kobo in the DB); only the display/mapping rounds. Consider returning minor units or 2-dp.
- [ ] **Jest "worker failed to exit gracefully"**: backend suites leave open handles (DB pool / cron timers); tests pass via `--forceExit`. Add proper teardown (`pool.end()`, `.unref()` on timers) to remove the warning.
- [ ] **Deploy target unconfigured**: `deploy.yml` + `ecosystem.config.cjs` are scaffolded but inert until the staging/production environments get `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_SSH_KEY`/`DEPLOY_PATH` secrets. Frontend `dist/` still needs a static host (e.g. nginx).
- [x] ~~4 pre-existing test failures~~ — **fixed [2026-06-05]**. Three were stale `auth.test.ts` expectations realigned to the `authenticate` middleware's hardened 401-fail-closed contract (it re-verifies the user / catches DB errors before the route runs). The fourth surfaced a real bug: `error-logger.service.ts` let a synchronous `pool.query` failure crash the `errorHandler` and swallow the HTTP response — now wrapped defensively. Full backend suite: 273/273 green.
