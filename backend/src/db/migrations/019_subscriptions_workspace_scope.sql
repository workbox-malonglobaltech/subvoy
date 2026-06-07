-- Phase 0 tenancy: scope subscriptions to a workspace + stamp the obligation kind.
--
-- This adds workspace_id (the new primary scoping key) and kind ('payment' for all
-- existing rows). The physical rename to `obligations` and the compliance-specific
-- columns land in Phase 1 when the compliance vertical is built; keeping the table
-- name here keeps the user_id → workspace_id re-scope focused and low-risk.

DO $$ BEGIN
  CREATE TYPE obligation_kind AS ENUM ('payment', 'compliance');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kind obligation_kind NOT NULL DEFAULT 'payment';

-- Backfill: attribute every existing subscription to its owner's Personal workspace
-- (migration 018 guarantees one exists per user).
UPDATE subscriptions s
SET workspace_id = w.id
FROM workspaces w
WHERE w.owner_id = s.user_id
  AND w.type = 'personal'
  AND s.workspace_id IS NULL;

-- Now that every row has a workspace, enforce NOT NULL.
ALTER TABLE subscriptions ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace ON subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_billing
  ON subscriptions(workspace_id, next_billing_date);
