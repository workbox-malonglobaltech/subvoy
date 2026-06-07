-- Phase 2: entitlements / limits registry.
--
-- Generic key→value limits resolved as: per-workspace override → per-plan default
-- → code fallback. Super-admin edits the per-plan defaults (the conversion dials)
-- and may grant per-workspace overrides (comps / enterprise / support).
--
-- limit_value = -1 means "unlimited". Keys are free-form (e.g.
-- 'max_payment_obligations', 'max_compliance_obligations', 'max_members') so new
-- limits need no schema change.

CREATE TABLE IF NOT EXISTS plan_limits (
  plan        VARCHAR(30)  NOT NULL,   -- 'free' | 'plus' | 'team' | 'business' ...
  limit_key   VARCHAR(60)  NOT NULL,
  limit_value INTEGER      NOT NULL,   -- -1 = unlimited
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plan, limit_key)
);

CREATE TABLE IF NOT EXISTS workspace_limit_overrides (
  workspace_id UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  limit_key    VARCHAR(60)  NOT NULL,
  limit_value  INTEGER      NOT NULL,   -- -1 = unlimited
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, limit_key)
);

-- Seed sensible per-plan defaults (idempotent). The free personal cap (10) is the
-- primary conversion dial — tunable live by the super admin.
INSERT INTO plan_limits (plan, limit_key, limit_value) VALUES
  ('free',     'max_payment_obligations',    10),
  ('plus',     'max_payment_obligations',    -1),
  ('free',     'max_compliance_obligations', 10),
  ('free',     'max_members',                 2),
  ('team',     'max_payment_obligations',    -1),
  ('team',     'max_compliance_obligations', -1),
  ('team',     'max_members',                10),
  ('business', 'max_payment_obligations',    -1),
  ('business', 'max_compliance_obligations', -1),
  ('business', 'max_members',                -1)
ON CONFLICT (plan, limit_key) DO NOTHING;
