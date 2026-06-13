# Google OAuth Verification — Subvoy Gmail scanning

Submission pack for verifying Subvoy's Google OAuth app so the **public** can connect
Gmail (today it's test-users-only). Prepared 2026-06-13.

> ⚠️ **Read §0 first — the scope we request is RESTRICTED.** This is the most
> demanding verification tier and has cost/time implications. There's a cheaper path.

---

## 0. The scope reality (decide this before submitting)

Subvoy requests **`https://www.googleapis.com/auth/gmail.readonly`** (see
`backend/src/services/gmail.service.ts`). Google classifies scopes in three tiers:

| Tier | Example | Verification needed |
|---|---|---|
| Non-sensitive | basic profile | none / quick |
| Sensitive | `gmail.metadata` | brand + app review |
| **Restricted** | **`gmail.readonly`** | brand + app review **+ annual CASA security assessment** |

`gmail.readonly` is **restricted** because it reads message bodies. Verification therefore requires a **CASA (Cloud Application Security Assessment) Tier 2** by a Google-authorized third party — **recurring annual cost (often ~US$1–4k+) and weeks of lead time**, plus a privacy policy, homepage, demo video, and a "limited use" commitment.

**Three options:**
1. **Pursue restricted verification (CASA).** Needed only if Gmail one-click OAuth is a launch-critical feature. Budget money + ~4–8 weeks.
2. **Lean on IMAP for launch (recommended).** The "Connect Email" (app-password) flow is **already built and needs no Google review** — it covers Gmail (via App Password), Yahoo, Outlook, custom domains. Ship with IMAP, pursue Gmail OAuth verification in parallel.
3. **Narrow the scope** to `gmail.metadata` (sensitive, no CASA) — but metadata has **no message body**, so receipt parsing wouldn't work. Not viable for our use case.

> **Recommendation:** ship with **IMAP** (Option 2); start CASA only if/when one-click Gmail is worth the recurring cost. The rest of this doc is the pack for when you do submit.

---

## 1. OAuth consent screen — config values

Google Cloud Console → APIs & Services → OAuth consent screen (User type: **External**).

| Field | Value |
|---|---|
| App name | **Subvoy** |
| User support email | *<your support email — e.g. support@subvoy.com>* |
| App logo | Subvoy mark (square PNG, 120×120, <1 MB) |
| Application home page | `https://subvoy.com` |
| Privacy policy URL | `https://subvoy.com/privacy` *(must exist + describe Google data use)* |
| Terms of service URL | `https://subvoy.com/terms` |
| Authorized domains | `subvoy.com` |
| Developer contact email | *<your email>* |
| Scopes | `.../auth/gmail.readonly` |
| Authorized redirect URI | `https://api.subvoy.com/email-import/callback/google` *(prod)* and `https://api.staging.subvoy.com/email-import/callback/google` *(staging)* |

> Privacy policy **must** explicitly cover: what Gmail data is accessed (read-only,
> for detecting subscription receipts), that it is **not** stored beyond derived
> subscription suggestions, not shared, not used for ads/ML, and how to revoke.

---

## 2. Scope justification (paste into the verification form)

> **Why Subvoy needs `gmail.readonly`:**
> Subvoy is a subscription- and bill-tracking app. With the user's explicit consent,
> we read the user's email **read-only** to detect recurring payment receipts (e.g.
> Netflix, Spotify, AWS invoices) and surface them as subscriptions the user can
> confirm and track. We search only for receipt-like messages over the last ~6 months,
> extract merchant, amount, and cadence, and present suggestions. We do **not** modify,
> send, delete, or label mail.
>
> **Minimum scope:** receipt detection requires reading message **bodies/snippets**,
> so `gmail.metadata` (headers only) is insufficient; `gmail.readonly` is the narrowest
> scope that works. We never request write/send/modify scopes.
>
> **Limited Use compliance:** Gmail data is used solely to provide the user-facing
> subscription-detection feature, is processed transiently (we persist only the derived
> subscription suggestions, never raw email content), is never sold, never used for
> advertising, and never used to train generalized models. Tokens are encrypted at rest
> (AES-256-GCM). Users can disconnect any time, which deletes stored tokens.

---

## 3. Demo video script (Google requires an unlisted YouTube video)

Record a ~2–4 min screen capture showing:
1. The **OAuth consent screen** with the Subvoy app name + the `gmail.readonly` scope.
2. Granting consent and returning to Subvoy (`/email-import?connected=gmail`).
3. The **value**: clicking "Scan", and the detected subscriptions appearing.
4. **Disconnect**: removing the account (show tokens are revoked/deleted).
5. Narrate that data is read-only and used only for subscription detection.

---

## 4. Pre-submission checklist

- [ ] **Decide Option 1 vs 2** (§0). If IMAP-first, you can stop here and submit later.
- [ ] Privacy policy + Terms pages live at `subvoy.com/privacy` + `/terms`, covering Google data use + Limited Use.
- [ ] OAuth consent screen filled per §1; production redirect URI added.
- [ ] App logo uploaded; homepage reachable + describes the app.
- [ ] Demo video recorded + unlisted on YouTube; link ready.
- [ ] Scope justification (§2) pasted.
- [ ] For restricted (`gmail.readonly`): engage a **CASA Tier-2 assessor**, complete the security questionnaire + pen-test evidence.
- [ ] Submit for verification; expect back-and-forth with the review team.

---

## 5. What's already done in code (no further work needed)

- Read-only scope only (`gmail.readonly`); no write/send scopes requested.
- OAuth tokens **encrypted at rest** (AES-256-GCM, `email-connection.ts`).
- Per-account disconnect deletes the stored tokens.
- Multi-account ready (a user can connect several inboxes once verified).
- IMAP fallback (`/email-import/imap/scan`) works **today** with no Google review.

> Bottom line: the **engineering is ready**; verification is a **business/process +
> (for restricted scope) paid-assessment** task. I can draft the privacy-policy /
> Limited-Use page copy next if you want to unblock §1.
