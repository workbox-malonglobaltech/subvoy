-- Scope detected subscriptions (CSV/email import staging) to a workspace, so an
-- import lands in the active workspace. user_id is kept as the creator.

ALTER TABLE detected_subscriptions
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Backfill to each owner's Personal workspace (migration 018 guarantees one).
UPDATE detected_subscriptions d
SET workspace_id = w.id
FROM workspaces w
WHERE w.owner_id = d.user_id AND w.type = 'personal' AND d.workspace_id IS NULL;

ALTER TABLE detected_subscriptions ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_detected_subs_workspace ON detected_subscriptions(workspace_id, status);
