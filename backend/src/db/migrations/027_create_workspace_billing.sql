-- Billing state per workspace. The entitlements source of truth is
-- workspaces.plan; this table tracks the paid-subscription metadata (provider,
-- references, period) so we can show status, verify webhooks, and expire plans.
--
-- v1 model: pay-per-period — a successful charge activates the plan until
-- current_period_end. Native provider auto-renew is a follow-up.

CREATE TABLE IF NOT EXISTS workspace_billing (
  workspace_id       UUID         PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  plan               VARCHAR(30)  NOT NULL DEFAULT 'free',
  provider           VARCHAR(20),                 -- 'paystack' | 'stripe'
  customer_ref       VARCHAR(255),
  reference          VARCHAR(255),                -- last checkout reference
  status             VARCHAR(20)  NOT NULL DEFAULT 'inactive', -- inactive|pending|active|canceled
  current_period_end TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_billing_reference ON workspace_billing(reference);
