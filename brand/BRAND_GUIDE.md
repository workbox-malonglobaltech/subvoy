# Subvoy Brand Guide
**Version 1.0 — April 2026**

---

## Table of Contents

1. [Brand Foundation](#1-brand-foundation)
2. [Logo System](#2-logo-system)
3. [Colour Palette](#3-colour-palette)
4. [Typography](#4-typography)
5. [Iconography](#5-iconography)
6. [Voice & Tone](#6-voice--tone)
7. [UI Patterns](#7-ui-patterns)
8. [Do's & Don'ts](#8-dos--donts)
9. [File Index](#9-file-index)

---

## 1. Brand Foundation

### What is Subvoy?

Subvoy is a subscription aggregation and payment management platform. Users track every recurring charge in one place, get reminders before payments hit, and (eventually) let Subvoy act as their trusted financial envoy — handling payments on their behalf.

### Name & Meaning

| | |
|---|---|
| **Name** | Subvoy |
| **Pronunciation** | /ˈsʌb·vɔɪ/ — "SUB-voy" |
| **Root words** | **Sub**scription + en**voy** |
| **Domain** | subvoy.com |

An *envoy* is a trusted agent sent on behalf of another. Subvoy is the trusted agent managing your subscriptions — it acts, notifies, and protects so you don't have to.

### Brand Promise

> *"Every subscription. Always in control."*

### Core Values

| Value | What it means |
|-------|---------------|
| **Clarity** | Users always know what they're paying for and when |
| **Trust** | Financial data is treated with bank-grade care |
| **Simplicity** | Complex subscription management made effortless |
| **Proactivity** | We surface problems before they become surprises |

### Target Audience

**Primary** — Nigerian professionals and households managing 3–15 subscriptions (streaming, SaaS, utilities) who struggle to track recurring charges across NGN and USD accounts.

**Secondary** — Diaspora Nigerians with dual-currency spending (USD subscriptions charged to NGN cards).

### Positioning Statement

*For busy professionals who feel anxious about surprise subscription charges, Subvoy is the subscription hub that gives complete visibility and control — unlike bank statements, Subvoy organises, reminds, and acts on your behalf.*

---

## 2. Logo System

### The Symbol — "S-Stack"

The Subvoy symbol combines three ideas into a single mark:

1. **Two overlapping cards** — the front card (white, full opacity) represents your active subscriptions. The back card (white, reduced opacity, rotated –5°) suggests the stack of all your recurring payments.
2. **EMV chip** — grounds the mark in payments and financial trust.
3. **Circular refresh arrow** — the badge on a dark indigo circle represents the recurring / renewal cycle. It echoes the "envoy" idea — always watching, always moving.

```
┌──────────────────────────────────────────────────────┐
│                              ╭──────╮                │
│   ╭─────────────────────╮   │  ↻   │  ← Badge       │
│  ╭─────────────────────╮│   ╰──────╯                │
│  │  ▪▪▪  [chip] ····   ││                            │
│  │  ───────────────     │╯  ← Front card (white)    │
│  │  ──────────          │   ← Back card (rotated)   │
│  ╰─────────────────────╯                             │
└──────────────────────────────────────────────────────┘
```

### Wordmark

The wordmark pairs the symbol with the name in two weights:

- **"Sub"** — Inter, weight 400, color `#111827` (near-black)
- **"voy"** — Inter, weight 700, color `#4F46E5` (Indigo 600)

The weight split subtly reinforces that the "voy" (envoy) part is the active, powerful component.

### Logo Variants

| File | Use case |
|------|----------|
| `logos/logo-primary.svg` | Default — light backgrounds, marketing |
| `logos/logo-reversed.svg` | Dark backgrounds, dark mode headers |
| `logos/logo-symbol-color.svg` | App icon contexts, avatars, favicons at 32px+ |
| `logos/logo-symbol-white.svg` | Embossed on coloured backgrounds |
| `logos/logo-symbol-dark.svg` | Monochrome print, one-colour embroidery |
| `logos/logo-wordmark-dark.svg` | Text-only contexts, email footers |

### Clear Space

Always maintain clear space equal to the height of the letter **"S"** in the wordmark around all sides of the logo. Never crowd the logo with other elements.

```
    ↑ S-height
  ← S →  [LOGO]  ← S →
    ↓ S-height
```

### Minimum Sizes

| Variant | Minimum |
|---------|---------|
| Full logo (symbol + wordmark) | 120px wide / 32mm |
| Symbol only | 24px / 6mm |
| Favicon | 16px (use `icons/icon-16.svg`) |

### Background Rules

| Background | Use |
|-----------|-----|
| White / light gray | `logo-primary.svg` ✓ |
| Indigo / dark | `logo-reversed.svg` ✓ |
| Photography | Place on white card overlay |
| Busy patterns | Always isolate on solid colour first |

---

## 3. Colour Palette

> Full visual reference: `colors/palette.svg`

### Primary — Indigo

| Name | Hex | RGB | Use |
|------|-----|-----|-----|
| Indigo 300 | `#A5B4FC` | 165, 180, 252 | Decorative accents, chip highlights |
| Indigo 400 | `#818CF8` | 129, 140, 248 | Gradient start, hover states |
| **Indigo 600** | **`#4F46E5`** | **79, 70, 229** | **Primary CTA buttons, links** |
| Indigo 700 | `#4338CA` | 67, 56, 202 | Gradient end, button hover |
| Indigo 900 | `#312E81` | 49, 46, 129 | Badge backgrounds, deep accents |
| Indigo 950 | `#1E1B4B` | 30, 27, 75 | Icon badge dark fill |

### Brand Gradient

```
Direction:  135° (top-left → bottom-right)
Start:      #818CF8  (Indigo 400)
End:        #4338CA  (Indigo 700)
```

Use the gradient on: app icon backgrounds, hero sections, the subscription cycle badge in the logo. Do **not** use the gradient on body text or small UI labels.

### Semantic Colours

| Name | Hex | Use |
|------|-----|-----|
| Success | `#10B981` | Payment confirmed, active status |
| Warning | `#F59E0B` | Payment due soon (1–3 days) |
| Danger | `#EF4444` | Overdue, failed payment, delete actions |
| Info | `#3B82F6` | Informational banners, tooltips |

### Neutrals

| Name | Hex | Use |
|------|-----|-----|
| Gray 900 | `#111827` | Body text, headings |
| Gray 700 | `#374151` | Secondary text |
| Gray 500 | `#6B7280` | Placeholder text, meta |
| Gray 400 | `#9CA3AF` | Disabled states, borders |
| Gray 300 | `#D1D5DB` | Dividers |
| Gray 200 | `#E5E7EB` | Card borders, input borders |
| Gray 100 | `#F3F4F6` | Page backgrounds, zebra rows |
| White | `#FFFFFF` | Card surfaces, modal backgrounds |

### Indigo Tints — UI Surfaces

| Name | Hex | Use |
|------|-----|-----|
| Indigo 50 | `#EEF2FF` | Hover state backgrounds, pill chips |
| Indigo 100 | `#E0E7FF` | Selected state backgrounds |
| Indigo 200 | `#C7D2FE` | Card decorative elements, data lines |

### Colour Accessibility

All text on white must meet **WCAG AA** (4.5:1 contrast for body, 3:1 for large text).

| Combo | Ratio | Pass |
|-------|-------|------|
| Gray 900 on White | 16.1:1 | ✓ AAA |
| Indigo 600 on White | 5.9:1 | ✓ AA |
| White on Indigo 600 | 5.9:1 | ✓ AA |
| Gray 500 on White | 4.6:1 | ✓ AA |
| Indigo 400 on White | 3.2:1 | ✗ (large text only) |

---

## 4. Typography

### Typeface

**Inter** — Available via Google Fonts (`https://fonts.google.com/specimen/Inter`)

Inter is a variable font designed for screens. It's highly legible at small sizes, has excellent number support (important for financial figures), and aligns with the modern/trustworthy personality of Subvoy.

### Type Scale

| Token | Size | Weight | Line Height | Use |
|-------|------|--------|-------------|-----|
| `display` | 36px / 2.25rem | 800 | 1.1 | Hero headlines |
| `h1` | 30px / 1.875rem | 700 | 1.2 | Page titles |
| `h2` | 24px / 1.5rem | 700 | 1.25 | Section headers |
| `h3` | 20px / 1.25rem | 600 | 1.3 | Card titles, modal headers |
| `h4` | 16px / 1rem | 600 | 1.4 | Sub-section labels |
| `body-lg` | 16px / 1rem | 400 | 1.6 | Body copy, descriptions |
| `body` | 14px / 0.875rem | 400 | 1.5 | Default UI text |
| `body-sm` | 13px / 0.8125rem | 400 | 1.4 | Secondary labels, meta |
| `caption` | 12px / 0.75rem | 400 | 1.4 | Timestamps, helper text |
| `overline` | 11px / 0.6875rem | 600 | 1.2 | All-caps section labels |
| `mono` | 13px / 0.8125rem | 400 | 1.4 | Card numbers, amounts (use tabular nums) |

### Financial Figures

Always render monetary amounts in **tabular numerals** (Inter supports this via `font-variant-numeric: tabular-nums`) so columns align correctly.

```css
.amount {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
```

### Wordmark — Specific Weights

```
"Sub" → Inter 400, #111827
"voy" → Inter 700, #4F46E5
```

---

## 5. Iconography

### Icon Library

**Heroicons** (outline style) — `https://heroicons.com`

Use the **outline** (24×24 SVG, 1.5px stroke) variant for all UI icons. Switch to **solid** only for active/selected states.

### Standard Sizes

| Context | Size |
|---------|------|
| Navigation, buttons | 20×20 |
| Body inline | 16×16 |
| Feature callouts | 24×24 |
| Empty states / illustrations | 40–48px |

### App Icons

| File | Size | Use |
|------|------|-----|
| `icons/favicon.svg` | 32×32 viewport | Browser tab (scalable) |
| `icons/icon-16.svg` | 16×16 | Browser favicon fallback, very small contexts |
| `icons/icon-32.svg` | 32×32 | Standard favicon, taskbar |
| `icons/icon-64.svg` | 64×64 | App launcher, bookmarks |
| `icons/icon-128.svg` | 128×128 | Extension icons, macOS dock |
| `icons/icon-512.svg` | 512×512 | App store submission, splash screens |

### Icon Simplification Across Sizes

| Size | Detail level |
|------|-------------|
| 512px | Full detail: chip contacts, number dots, card shadow, fine badge stroke |
| 128px | Full detail: chip lines, dots, inner-shadow filter |
| 64px | Simplified: chip block only, no inner lines |
| 32px | Minimal: chip block, one data line, smaller badge |
| 16px | Stripped: gradient background + white S-stroke only |

---

## 6. Voice & Tone

### Brand Personality

| Trait | What it sounds like |
|-------|-------------------|
| **Confident** | Declarative, not wishy-washy |
| **Warm** | Friendly, not corporate |
| **Precise** | Exact amounts and dates, not vague |
| **Proactive** | We surface things before they ask |
| **Respectful** | We never blame the user |

### Vocabulary

**Use** | **Avoid**
---|---
Subscription | Bill, charge, fee (unless quoting)
Wallet | Account balance (use Wallet consistently)
Fund wallet | Deposit, credit, load
Pay now | Execute payment, initiate transaction
Billing cycle | Payment frequency
Next billing date | Due date (use next billing date in UI)
₦ / $ | NGN, USD (use symbols in UI, codes in code)

### Tone by Context

**Onboarding — Welcoming, clear**
> "Add your first subscription. We'll remind you before it renews."

**Reminders — Friendly urgency**
> "📅 Netflix renews in 2 days — ₦4,800 will be charged."

**Errors — Honest, actionable**
> "We couldn't connect to the payment processor. Your wallet hasn't been charged. Please try again."

**Danger zones — Direct, no drama**
> "This will permanently delete your account and all subscription data."

**Empty states — Encouraging**
> "No subscriptions yet. Add your first one to start tracking."

### Writing Rules

1. **Sentence case** everywhere (not Title Case) except proper nouns and acronyms
2. **Active voice** — "We'll remind you" not "You will be reminded"
3. **Oxford comma** always
4. **Amounts** — Always show currency symbol: `₦4,800.00` or `$12.99`
5. **Dates** — Use `15 Apr 2026` format (no ambiguous MM/DD/YY)
6. **Numbers** — Spell out one–nine; use numerals for 10+

---

## 7. UI Patterns

### Spacing System (Tailwind)

Use the Tailwind CSS default 4px base grid. Common tokens:

| Token | px | Use |
|-------|-----|-----|
| `p-2` | 8px | Tight padding (badges, chips) |
| `p-3` | 12px | Button padding, small inputs |
| `p-4` | 16px | Card internal padding (mobile) |
| `p-5` | 20px | Card internal padding (desktop) |
| `p-6` | 24px | Section padding |
| `gap-3` | 12px | Tight flex/grid gaps |
| `gap-4` | 16px | Standard grid gap |
| `gap-6` | 24px | Section separation |

### Border Radius

| Token | px | Use |
|-------|-----|-----|
| `rounded-lg` | 8px | Buttons, inputs, small cards |
| `rounded-xl` | 12px | Modal dialogs |
| `rounded-2xl` | 16px | Main dashboard cards |
| `rounded-full` | 50% | Badges, avatars, toggle pills |

### Elevation / Shadow

```css
/* Cards */
shadow-sm  → box-shadow: 0 1px 2px rgb(0 0 0 / 0.05)

/* Modals */
shadow-xl  → box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1)

/* Dropdown menus */
shadow-lg  → box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1)
```

### Buttons

| Variant | Class pattern | Use |
|---------|-------------|-----|
| Primary | `bg-indigo-600 text-white hover:bg-indigo-700` | Main CTA |
| Secondary | `border border-gray-300 text-gray-600 hover:bg-gray-50` | Alternative actions |
| Danger | `bg-red-600 text-white hover:bg-red-700` | Destructive actions |
| Ghost | `text-gray-500 hover:text-gray-700 hover:bg-gray-100` | Tertiary / icon buttons |

All buttons: `px-4 py-2 rounded-lg text-sm font-semibold transition-colors`

### Form Inputs

```
border border-gray-300 rounded-lg px-3 py-2 text-sm
focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
placeholder:text-gray-400
```

### Status Badges

| Status | Class pattern |
|--------|-------------|
| Active | `bg-green-100 text-green-700` |
| Paused | `bg-gray-100 text-gray-600` |
| Overdue | `bg-red-100 text-red-700` |
| Due soon | `bg-amber-100 text-amber-700` |
| Trial | `bg-blue-100 text-blue-700` |

All badges: `text-xs font-medium px-2 py-0.5 rounded-full`

### Cards

Standard subscription card structure:
```
rounded-2xl border border-gray-200 bg-white p-5 shadow-sm
hover:shadow-md transition-shadow
```

### Wallet Cards

- **USD card** — Indigo gradient background, white text
- **NGN card** — White background, dark text, indigo accent

---

## 8. Do's & Don'ts

### Logo

| ✓ Do | ✗ Don't |
|------|---------|
| Use on plain light or dark backgrounds | Place on busy photos without overlay |
| Maintain clear space | Crowd with other logos or text |
| Use the correct variant for the background | Use the color symbol on a dark bg (use white variant) |
| Scale proportionally | Stretch or squash |
| Minimum 24px for symbol alone | Use below minimum sizes |

### Colour

| ✓ Do | ✗ Don't |
|------|---------|
| Use Indigo 600 for primary actions | Use the gradient on body text |
| Use semantic colours consistently | Use red for non-destructive/non-error states |
| Maintain WCAG AA contrast | Use Indigo 400 on white for body text |
| Use white cards on light gray page backgrounds | Use pure black (`#000000`) — use Gray 900 |

### Typography

| ✓ Do | ✗ Don't |
|------|---------|
| Use Inter exclusively | Mix typefaces |
| Use tabular nums for amounts | Use proportional nums in tables |
| Sentence case in UI | Title Case every label |
| Use the defined weight split for wordmark | Use other weights for "Sub" / "voy" |

### Writing

| ✓ Do | ✗ Don't |
|------|---------|
| Be direct: "Netflix renews tomorrow" | Be vague: "A subscription may be renewing soon" |
| Show exact amounts with currency symbol | Show amounts without currency: "4,800.00" |
| Use dates: "15 Apr 2026" | Use ambiguous: "04/15/26" |
| Active voice | Passive voice in notifications |

---

## 9. File Index

```
brand/
├── BRAND_GUIDE.md              ← This document
│
├── logos/
│   ├── logo-primary.svg        200×56 — Symbol + wordmark, light bg
│   ├── logo-reversed.svg       200×56 — White version, dark bg
│   ├── logo-symbol-color.svg   64×64  — Color symbol only
│   ├── logo-symbol-white.svg   64×64  — White symbol only
│   ├── logo-symbol-dark.svg    64×64  — Dark/monochrome symbol
│   └── logo-wordmark-dark.svg  140×40 — Text-only wordmark
│
├── icons/
│   ├── favicon.svg             32×32  — Browser tab (scalable SVG)
│   ├── icon-16.svg             16×16  — Simplified S-stroke
│   ├── icon-32.svg             32×32  — Minimal detail
│   ├── icon-64.svg             64×64  — Medium detail
│   ├── icon-128.svg            128×128 — Full detail
│   └── icon-512.svg            512×512 — App store / splash
│
└── colors/
    └── palette.svg             760×520 — Full color palette reference
```

### Generating PNG Exports

When bitmap versions are needed (e.g. App Store, Play Store), export from the SVGs using:

```bash
# Using Inkscape (free)
inkscape icon-512.svg --export-png=icon-512.png --export-width=512

# Using ImageMagick + librsvg
rsvg-convert -w 512 -h 512 icon-512.svg > icon-512.png

# Using sharp (Node.js)
npx sharp-cli --input icon-512.svg --output icon-512.png --width 512
```

### Required App Store Sizes (iOS / Android)

| Platform | Size | Source file |
|----------|------|-------------|
| iOS App Store | 1024×1024 | `icon-512.svg` (export @2×) |
| iOS Home Screen @3× | 180×180 | `icon-512.svg` |
| Android Play Store | 512×512 | `icon-512.svg` |
| Android Adaptive Icon | 108×108 (with padding) | `icon-128.svg` |
| PWA manifest 192px | 192×192 | `icon-512.svg` |
| PWA manifest 512px | 512×512 | `icon-512.svg` |
| Favicon .ico | 16, 32, 48 bundled | `icon-16.svg`, `icon-32.svg` |

---

*Subvoy Brand Guide v1.0 — Last updated April 2026*
*Questions? Contact the product team.*
