import type { CookieOptions } from 'express';

/**
 * Single source of truth for the auth cookie. Env-driven so the SAME build works
 * for same-origin (default) and split-origin (api.subvoy.com ↔ subvoy.com):
 *
 *   COOKIE_SAMESITE  'lax' (default) | 'strict' | 'none'
 *   COOKIE_SECURE    'true' to force Secure (auto-on in production)
 *   COOKIE_DOMAIN    e.g. '.subvoy.com' for cross-subdomain sharing
 *
 * NOTE: 'lax' blocks cross-site POST (CSRF-safe for state changes) while still
 * allowing OAuth redirect returns. If you set SameSite=None for split-origin,
 * you MUST add CSRF tokens (cookie auth becomes cross-site forgeable otherwise).
 */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function sameSite(): CookieOptions['sameSite'] {
  const v = (process.env.COOKIE_SAMESITE ?? 'lax').toLowerCase();
  return v === 'strict' || v === 'none' ? v : 'lax';
}

function secure(): boolean {
  return process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
}

function domain(): string | undefined {
  return process.env.COOKIE_DOMAIN || undefined;
}

/** Options for res.cookie('token', …). */
export function authCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: secure(), sameSite: sameSite(), domain: domain(), maxAge: SEVEN_DAYS_MS };
}

/** Options for res.clearCookie('token', …) — must match attrs except maxAge. */
export function clearCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: secure(), sameSite: sameSite(), domain: domain() };
}
