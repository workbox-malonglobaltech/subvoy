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

---

## Known Issues / Tech Debt
<!-- Track things that need fixing later -->
- [ ] [Add items here]
