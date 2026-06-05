DO $$ BEGIN
  CREATE TYPE billing_cycle AS ENUM ('weekly', 'monthly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  next_billing_date DATE NOT NULL,
  category VARCHAR(100),
  logo_url VARCHAR(500),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_date);
