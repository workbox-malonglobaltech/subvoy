-- Assign a compliance obligation to a workspace member. Reminders go to the
-- assignee when set, otherwise the creator. ON DELETE SET NULL so removing a
-- member leaves the obligation unassigned (not deleted).

ALTER TABLE compliance_items
  ADD COLUMN IF NOT EXISTS assignee_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_assignee ON compliance_items(assignee_user_id);
