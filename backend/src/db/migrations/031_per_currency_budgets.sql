-- Migration 031: per-currency budgets.
-- budget_limits maps currency -> monthly limit, e.g. {"NGN": 50000, "USD": 200}.
-- Replaces the single (USD-assumed) budget_limit for both display and alerts;
-- budget_limit is kept for backward-compat but no longer the source of truth.
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS budget_limits jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Carry any existing single budget into the map under USD (how it was treated).
UPDATE notification_preferences
   SET budget_limits = jsonb_build_object('USD', budget_limit)
 WHERE budget_limit IS NOT NULL
   AND budget_limits = '{}'::jsonb;
