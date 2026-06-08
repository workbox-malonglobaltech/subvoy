# Subvoy — Product Roadmap & Architecture (source of truth)

> Forward plan and locked decisions. CLAUDE.md holds the short decisions log;
> this file holds the architecture, monetization, and phased build plan.
> Last updated: 2026-06-05.

---

## 1. Vision

Subvoy is an **obligations platform**: anything recurring and deadline-bound that
you need to **track**, be **reminded** of, and (eventually) have **fulfilled for you**.

> **A recurring, deadline-bound obligation → track → remind → fulfill.**

Subscriptions were the first vertical; the product generalizes to two:

| Vertical | Obligation kind | Fulfillment |
|----------|-----------------|-------------|
| Subscriptions / payments | `payment` | **pay-for-you** (autopay) — *built* |
| Compliance (business) | `compliance` | **do-for-you** (file/act on behalf) — *v2* |

The reminder engine, notifications, calendar, scheduling, and "advance to next due
date" logic are **shared**; only the fulfillment action differs per kind.

---

## 2. Architecture: workspaces × obligation kinds (two decoupled axes)

**One login → 1 Personal workspace (auto) + N Business workspaces.** Workspace
*type* unlocks capabilities; obligation *kind* is independent of type.

### Capability matrix
| Capability | Personal workspace | Business workspace |
|---|---|---|
| Subscriptions / payments (+ autopay) | ✅ | ✅ |
| Compliance (custom obligations, docs, status) | ❌ | ✅ |
| Teammates / roles | ❌ (solo) | ✅ |
| Billing | personal plan | per-workspace + seats |

- **Payments are universal**; **compliance is Business-only** (a solo freelancer who
  wants tax-deadline tracking creates a solo Business workspace — also a paid event).
- A single user separates personal vs business subs by having multiple workspaces:
  ```
  You (one login)
  ├── Personal        → Netflix, Spotify            (payments)
  ├── "Acme Ltd"      → SaaS subs + CAC/tax filings  (payments + compliance, team)
  └── "Side Hustle"   → its subs + its filings       (payments + compliance, solo)
  ```

### Compliance scope (v1)
**Flexible / custom obligations** — businesses define their own recurring compliance
tasks + deadlines. **No jurisdiction rules engine in v1.** Fields: authority/regulator,
reference no., jurisdiction, penalty-for-late, required documents, status workflow.

### Data model (target)
- `users` — identity
- `workspaces(id, type[personal|business], name, owner_id, plan)`
- `workspace_members(workspace_id, user_id, role[owner|admin|member])`
- `obligations(id, workspace_id, kind[payment|compliance], name, cadence,
  next_due_date, reminder_offsets, status, metadata jsonb, …)` — generalizes today's
  `subscriptions`; payment fields kept, compliance fields nullable.
- Everything currently `user_id`-scoped becomes `workspace_id`-scoped.
- Migration: existing subscriptions → `obligations(kind=payment)` under each user's
  auto Personal workspace.

> **Naming caution:** the product's "subscriptions" (payment obligations) are distinct
> from **SaaS plan billing**. The wallet/Paystack we built **funds autopay**; charging
> customers for Subvoy plans is a separate flow (Paystack Plans/Subscriptions).

---

## 3. Monetization

### Revenue engines
1. **SaaS plans (primary)** — Personal Plus + Business Team/Business, per workspace + **seats**.
2. **Fintech layer (built infra)** — **fee per autopay**, **FX spread** on NGN→USD top-ups, (later) **wallet float/yield**.
3. **Services & marketplace (v2)** — **do-for-you compliance** (per filing / premium tier) + partner referrals (accountants/lawyers/filing agents).
4. **Later** — subscription-savings affiliate, add-ons (storage, API, integrations, white-label).

### Flywheel
Free personal subs → habit/brand → Business workspace (paid, seats) → wallet top-ups
(autopay fees + FX spread) → do-for-you / partners.

### Pricing (placeholders — NGN points TBD, tune with data)
**Personal (per user)**
| Tier | ~Price | Includes |
|---|---|---|
| Free | ₦0 | Track up to **~10** subs/payments (admin-tunable cap), reminders, basic dashboard |
| Plus | ~$2.5 / ₦2,500 mo | **Unlimited** items, **autopay**, price-change alerts, multi-currency, SMS/WhatsApp + custom lead times, spend analytics |

**Business (per workspace + seats)**
| Tier | ~Price | Includes |
|---|---|---|
| Free | ₦0 | 1 workspace, ~10 obligations, 2 members |
| Team | ~$12 mo or $4/seat | Unlimited obligations, ~10 members, roles, audit log, custom cadences, document attachments, calendar/Slack export |
| Business | ~$40+ mo or $9/seat | **Do-for-you (v2)**, API, SSO, advanced reporting, priority support |

### Free-tier cap (the #1 conversion dial)
- Pain scales with item count → the **count is the meter**. Power users (25+ subs) hit
  the wall and convert; casual users (<10) stay free as the funnel.
- Default ~10, **hard cap** on count (leaning), but **set live by the super admin** — not hardcoded.
- Hitting the wall offers **two paths**: upgrade to Plus, or "move work subs to a Business workspace."

### Admin-managed limits (generic entitlements registry)
- A **generic limits registry** (personal cap, business cap, free seats, free-autopay count, …) — not a one-off.
- **Resolution:** per-account override → plan default (admin-set) → system fallback (code).
- Super-admin UI for **global per-plan defaults + per-account overrides** (comps/enterprise/support).
- Audit-logged, server-enforced, cached on the hot path, code fallback so it works pre-config.

---

## 4. v1 / v2 boundary

**v1 (1.0 release) — everything except do-for-you:**
- Workspaces (Personal + Business) + teams/roles
- Obligations engine: payments (all workspaces) + compliance tracking (Business only, flexible/custom)
- Reminders (multi lead-time) + notifications + unified calendar
- **Pay-for-you / autopay** ✅ *already built*
- Monetization: plans, per-workspace + seats, Paystack-Plans billing, paywalls
- Admin limits registry (generic; global per-plan + per-account overrides)
- Launch (Cloudflare Pages + Oracle + Neon)

**v2 — only:**
- **Do-for-you compliance** (file/act on behalf) — regulated; assisted-first, legal review before automation.

> "v1 = everything" is the finish line, not the build order. We still build in phases
> (below); do-for-you is held for post-1.0.

---

## 5. Phased build plan

| Phase | Theme | Outcome |
|---|---|---|
| **0** | Foundation | Obligations engine + multi-tenant workspaces/members; existing data migrated |
| **1** | Verticals (parallel) | Payments in all workspaces (re-homed) + Business compliance (flexible) + teams |
| **2** | Monetization | Plans, entitlements/limits registry, Paystack-Plans billing, seats, paywalls |
| **3** | v2 | Do-for-you compliance (risk-scoped) |

### Phase 0 — Foundation (executable tickets) · branch `feature/workspaces-foundation`
| Ticket | Scope |
|---|---|
| T0.1 | Migration `018`: `workspaces` + `workspace_members`; auto-create Personal on signup; backfill existing users |
| T0.2 | Capability map (server-side `type → {kinds, teams}`) + `canUseKind()` helper |
| T0.3 | Migration `019`: generalize `subscriptions → obligations(workspace_id, kind, …)`; migrate rows to `kind=payment` |
| T0.4 | Re-scope models/routes/jobs `user_id → workspace_id` (payments, reminders, autopay, notifications, analytics, wallet); kind-aware ← **risk checkpoint** |
| T0.5 | Workspace context + membership/role/capability middleware (server source of truth) |
| T0.6 | Frontend workspace switcher + context; render enabled kinds only; route guards |
| T0.7 | Isolation + capability tests (cross-workspace denial; compliance-in-personal → 403) |

### Phase 1 — Verticals
Payments re-home (reuse) · compliance fields + multi-offset reminders · compliance UI
(create/track/status/docs) · team management UI · reminder digests · unified calendar/dashboard by kind.

### Phase 2 — Monetization (incl. entitlements)
Entitlements/limits registry (E1–E6: config table + resolver + hot-path enforcement +
super-admin UI for per-plan & per-account + tests) · Paystack-Plans billing + seats ·
feature gating (autopay=Plus; teams/audit/cadences=Team) · upgrade/seat UI · autopay-fee + FX-spread config.

### Phase 3 — v2
Do-for-you compliance: assisted-first ("prepared filing + human-in-the-loop"), legal/ops scoping before automation.

---

## 6. Stack (after Phase 0–2; refactor-first)

| Layer | Pick | Note |
|---|---|---|
| Web | **Vercel** (`subvoy.com`) | Vite SPA; point Cloudflare DNS at Vercel |
| Mobile | **React Native (Expo)** — later | reuses the same API + shared types (API-first) |
| API | **Express** — host TBD (see fork below) | `api.subvoy.com` |
| DB | **Supabase** (Postgres + Storage + pg_cron) | also covers compliance-document storage + scheduling; Neon is the pure-Postgres alt — both are Postgres, migrations identical |
| Email | **Resend** | replace nodemailer SMTP (SMTP drop-in or SDK) |
| Payments | **Paystack + Stripe**, per-country routing | Paystack = Africa; Stripe = rest of world (see §9) |

- **Routing:** **split origin** — build with `VITE_API_URL=https://api.subvoy.com`; backend CORS allowlists `https://subvoy.com`; cookies `domain=.subvoy.com; SameSite=None; Secure`.
- **⚠️ Serverless ↔ cron fork (resolve before launch):** the backend runs `node-cron` jobs **in-process**, which serverless (Vercel functions) can't host. Two options:
  1. **Always-on API** (Fly/Render/Railway/Oracle) — keep in-process cron, least change; or
  2. **Vercel functions** + convert the 4 jobs to **secured HTTP endpoints** triggered by an external scheduler (GitHub Actions cron / Vercel Cron / Supabase pg_cron / Upstash QStash).
  Does **not** block Phase 0 (pure Postgres + app code).
- Deploy runs `db:migrate` on release; secrets per environment.

## 6b. Mobile (React Native / Expo)
- **React Native (Expo)** consuming the same REST API; shares `src/shared/types`. New `mobile/` workspace.
- **Auth:** add **`Authorization: Bearer` support** to the `authenticate` middleware (it currently reads the httpOnly cookie only) and return the token in `/auth/login`+`/auth/register` bodies for native clients. Web keeps the cookie; mobile uses bearer + `expo-secure-store`. **This bearer prerequisite blocks all mobile work.**
- Native Google sign-in via `expo-auth-session` (different flow from the web redirect). Workspace scoping reuses `X-Workspace-Id`.
- Push notifications via `expo-notifications` (device-token registration + backend send) extend the reminder/compliance jobs.
- **Build after web v1 is launched + validated** (mobile is effectively a second product; don't build it before the web product has live users).

### 6b-i. Billing on mobile — DECIDED: Netflix / "reader" model (no IAP)
Two distinct payment types; only one is even in scope of store rules:
- **Wallet top-ups / autopay / paying the user's real bills** → **exempt** from store IAP ("goods & services consumed outside the app", Apple 3.1.3/3.1.5; like Uber/Cash App). Works normally in-app.
- **Subvoy's own plan** (Plus/Team/Business) → **not sold in-app**. Users upgrade on **subvoy.com** (existing Paystack/Stripe checkout); the app only authenticates and reflects the account's plan. Avoids the 15–30% store cut.

**Mobile rules of engagement:** read-only plan screen (current plan + features) + a neutral "Manage your plan at subvoy.com"; **no in-app buy buttons / no plan prices on a buy path.** This drops the entire IAP workstream (mobile Plans task becomes a small read-only screen). ⚠️ Store policies shift (Epic v. Apple, EU DMA, US external-link entitlement) — re-verify Apple 3.1.1/3.1.3/3.1.5 + Play Payments at submission.

## 6c. Global from day one
The app serves users **worldwide**; **country-specific settings are toggled in the super-admin dashboard** (extends the limits registry into a broader platform-config registry).

- **`country_settings` registry** (admin-managed): per-country `enabled`, default currency, payment provider, (later) compliance template packs, date/number formats.
- **Payments are regional:** Paystack (Africa) + **Stripe (global)** behind a **provider abstraction** routed by the workspace's country. Current wallet/top-up is Paystack-only → must generalize. Tracking + reminders + compliance are global immediately; **payments roll out per country** as providers are enabled.
- **Per-user / per-workspace timezone** so reminders fire at sensible local times (today cron uses a single `REMINDER_TIMEZONE`). Store `users.timezone` / `workspaces.country`.
- **Currencies** per country settings (multi-currency + FX already exist).
- **Later:** i18n/localization; data-residency & privacy (GDPR/NDPR etc.).

---

## 7. Already built (reuse, don't rebuild)
Subscription tracking + dashboard · email/CSV import & detection · multi-currency (FX) ·
wallet + Paystack top-ups · **pay-for-you / autopay** (transactional, idempotent) ·
analytics · reports · notifications/reminders (cron) · onboarding · PWA · OAuth ·
**admin panel** (users, audit log, error tracking, announcements, stats) · password reset.
Backend 273/273 tests green.

---

## 8. Open decisions (still to settle)
- [ ] **API host / cron model**: always-on API (in-process cron) vs Vercel functions + external scheduler (§6 fork).
- [ ] **DB**: Supabase (DB + storage + pg_cron) vs Neon (pure Postgres + separate storage) — leaning Supabase.
- [x] **Mobile billing** — DECIDED: **Netflix/reader model, no IAP** (plans bought on web; wallet/bill payments exempt). See §6b-i.
- [x] **Web/mobile auth** — DECIDED: cookie (web) + **bearer** (mobile); add bearer to `authenticate`. See §6b.
- [ ] **Brand**: keep everything under "Subvoy" or give the business/compliance side its own name on the shared backend.
- [ ] **Price points** per tier + currency (placeholders above).
- [ ] **Starting free cap number** (default ~10) and **hard vs soft** cap (leaning hard) — set live by super admin.
- [ ] **Global payments v1 scope**: which countries/providers enabled at launch (recommend: tracking+reminders+compliance global; payments start with Paystack/Africa, Stripe fast-follow).
- [ ] Business-specific payment metadata (vendor, cost-center, approver, invoice) — likely post-foundation.
