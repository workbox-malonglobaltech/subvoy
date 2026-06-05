-- Per-user wallet auto top-up and scheduled top-up preferences.

CREATE TABLE IF NOT EXISTS wallet_settings (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  auto_topup_enabled   BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Threshold in USD cents: top up dollar card when balance drops below this
  threshold_usd_cents  INTEGER     NOT NULL DEFAULT 3000,   -- default $30.00
  -- Amount in NGN kobo to pull from bank and convert each auto top-up
  topup_ngn_kobo       BIGINT      NOT NULL DEFAULT 5000000, -- default ₦50,000
  -- Day of month (1–28) for scheduled monthly top-up; NULL = no scheduled top-up
  scheduled_day        SMALLINT    DEFAULT NULL
    CONSTRAINT wallet_settings_day_check CHECK (scheduled_day BETWEEN 1 AND 28),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_settings_user ON wallet_settings(user_id);
