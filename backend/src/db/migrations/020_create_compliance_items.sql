-- Phase 1: compliance obligations (Business workspaces only).
--
-- Kept as a separate table from `subscriptions` (payments): the field sets diverge
-- (no amount/currency; instead authority, reference, status, documents) and this
-- keeps the working payments/autopay path untouched. The unified "obligations"
-- view (shared calendar/dashboard) is composed at the API layer across both.
--
-- v1 is flexible/custom — businesses define their own obligations + deadlines; no
-- jurisdiction rules engine. `status` is stored as a workflow state; "overdue" is
-- DERIVED (due_date < today AND status <> 'completed'), not stored.

DO $$ BEGIN
  CREATE TYPE compliance_cadence AS ENUM ('one_off', 'weekly', 'monthly', 'quarterly', 'yearly');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE compliance_status AS ENUM ('open', 'submitted', 'completed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS compliance_items (
  id               UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID               NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id          UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- creator
  title            VARCHAR(255)       NOT NULL,
  description      TEXT,
  authority        VARCHAR(255),      -- regulator / body (e.g. "CAC", "FIRS")
  reference_number VARCHAR(120),
  jurisdiction     VARCHAR(2),        -- ISO 3166-1 alpha-2, optional
  cadence          compliance_cadence NOT NULL DEFAULT 'one_off',
  due_date         DATE               NOT NULL,
  reminder_offsets INTEGER[]          NOT NULL DEFAULT '{30,7,1}', -- days before due_date
  status           compliance_status  NOT NULL DEFAULT 'open',
  penalty_note     TEXT,
  is_active        BOOLEAN            NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_workspace      ON compliance_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_compliance_workspace_due  ON compliance_items(workspace_id, due_date);
