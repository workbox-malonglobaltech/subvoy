-- Let notifications reference a compliance item (subscription_id is FK'd to
-- subscriptions, so it can't hold a compliance_items id). Nullable; either
-- subscription_id OR compliance_item_id is set, never both.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS compliance_item_id UUID REFERENCES compliance_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_compliance
  ON notifications(user_id, compliance_item_id);
