-- 037: Billing history — one row per successful plan payment.
--
-- `workspace_billing` holds only the CURRENT state (single row per workspace).
-- This append-only log lets a workspace see past charges (the "billing history"
-- in settings). Written by the billing webhook on each successful activation.

CREATE TABLE IF NOT EXISTS billing_history (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan         VARCHAR(30)  NOT NULL,
  provider     VARCHAR(20),
  reference    VARCHAR(255),
  amount_minor INTEGER      NOT NULL DEFAULT 0,   -- minor units (cents/kobo)
  currency     VARCHAR(3)   NOT NULL DEFAULT 'USD',
  period_end   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_history_workspace
  ON billing_history(workspace_id, created_at DESC);
