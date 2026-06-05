-- Autopay: charge a subscription automatically from the wallet on its billing date.
--
-- subscriptions.autopay              — opt-in flag, per subscription
-- subscriptions.autopay_max_amount   — guardrail: skip auto-charge if amount exceeds
--                                       this (NULL = no cap). Manual pay ignores it.
-- wallet_settings.autopay_default    — UI default for the toggle on new subscriptions.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS autopay BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS autopay_max_amount NUMERIC(10, 2)
    CONSTRAINT subscriptions_autopay_max_positive
    CHECK (autopay_max_amount IS NULL OR autopay_max_amount > 0);

-- Partial index: the autopay scan only ever looks at active, autopay-enabled rows.
CREATE INDEX IF NOT EXISTS idx_subscriptions_autopay_due
  ON subscriptions (next_billing_date)
  WHERE autopay = TRUE AND is_active = TRUE;

ALTER TABLE wallet_settings
  ADD COLUMN IF NOT EXISTS autopay_default BOOLEAN NOT NULL DEFAULT FALSE;
