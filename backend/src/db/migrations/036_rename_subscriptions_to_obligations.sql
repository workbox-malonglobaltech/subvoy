-- 036: Rename `subscriptions` → `obligations` (completes the obligations(kind) model).
--
-- Background: migration 019 already added the `kind obligation_kind` discriminator
-- ('payment' | 'compliance') to this table, and 020 created `compliance_items` as a
-- deliberately separate table (divergent field sets, composed at the API layer). This
-- migration finishes the data-model rename so the payment-obligations table is named
-- for what it holds. Compliance stays its own table; both are "obligations" by kind.
--
-- This is a pure rename: no data is moved, no columns change. Foreign keys
-- (e.g. notifications.subscription_id → subscriptions.id) follow the table by OID
-- automatically, so they keep working and need no edits. The `subscription_id`
-- COLUMN name on `notifications` is intentionally left unchanged.

ALTER TABLE subscriptions RENAME TO obligations;

-- Indexes keep their old names after a table rename; realign them for clarity.
ALTER INDEX IF EXISTS idx_subscriptions_user_id          RENAME TO idx_obligations_user_id;
ALTER INDEX IF EXISTS idx_subscriptions_next_billing      RENAME TO idx_obligations_next_billing;
ALTER INDEX IF EXISTS idx_subscriptions_autopay_due       RENAME TO idx_obligations_autopay_due;
ALTER INDEX IF EXISTS idx_subscriptions_workspace         RENAME TO idx_obligations_workspace;
ALTER INDEX IF EXISTS idx_subscriptions_workspace_billing RENAME TO idx_obligations_workspace_billing;

-- Transitional backward-compat shim: a plain 1:1 (auto-updatable) view so any
-- reader that still references the old name keeps working through the cut-over.
-- All application SQL has been moved to `obligations` in the same change; this view
-- exists only as production insurance and should be dropped in a later migration
-- once logs confirm nothing reads `subscriptions` directly. Do NOT drop columns from
-- `obligations` while this view exists (the view depends on them).
CREATE VIEW subscriptions AS SELECT * FROM obligations;
