-- Stores pending and completed Paystack payment sessions for wallet top-ups.
-- The paystack_reference is the unique key used to correlate webhooks and
-- callback verifications, and to prevent double-crediting.

CREATE TABLE IF NOT EXISTS wallet_topup_sessions (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paystack_reference  TEXT          NOT NULL UNIQUE,
  -- Amount the user intends to deposit, in kobo (1 NGN = 100 kobo)
  amount_ngn_kobo     BIGINT        NOT NULL CHECK (amount_ngn_kobo > 0),
  -- 'ngn' = credit NGN balance only; 'usd' = convert and credit USD balance
  destination         TEXT          NOT NULL DEFAULT 'ngn' CHECK (destination IN ('ngn', 'usd')),
  -- Lifecycle: pending → completed | failed
  status              TEXT          NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'failed')),
  -- Timestamp when the payment was confirmed (for auditing)
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topup_sessions_user      ON wallet_topup_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_topup_sessions_status    ON wallet_topup_sessions(status);
CREATE INDEX IF NOT EXISTS idx_topup_sessions_reference ON wallet_topup_sessions(paystack_reference);
