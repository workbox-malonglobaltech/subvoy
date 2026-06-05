-- One wallet row per user.
-- ngn_balance and usd_balance are stored as integers (kobo / cents) to avoid
-- floating-point rounding issues in financial calculations.
-- Display layer divides by 100.

CREATE TABLE IF NOT EXISTS wallets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  ngn_balance BIGINT      NOT NULL DEFAULT 0,   -- stored in kobo (1 NGN = 100 kobo)
  usd_balance BIGINT      NOT NULL DEFAULT 0,   -- stored in cents (1 USD = 100 cents)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- ── Wallet transactions log ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(30) NOT NULL,          -- 'deposit', 'payment', 'conversion', 'auto_topup'
  currency        VARCHAR(3)  NOT NULL,          -- 'NGN' or 'USD'
  amount          BIGINT      NOT NULL,          -- in kobo or cents, always positive
  direction       VARCHAR(4)  NOT NULL,          -- 'in' or 'out'
  description     TEXT        NOT NULL,
  balance_after   BIGINT      NOT NULL,          -- wallet balance after this transaction
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_txns_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txns_created  ON wallet_transactions(user_id, created_at DESC);
