CREATE TABLE IF NOT EXISTS detected_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
  next_billing_date DATE,
  category VARCHAR(100),
  confidence INTEGER NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  occurrences INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  raw_transactions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detected_subs_user_id ON detected_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_detected_subs_status ON detected_subscriptions(user_id, status);
