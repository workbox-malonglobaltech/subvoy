CREATE TABLE IF NOT EXISTS email_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('gmail', 'outlook')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  email VARCHAR(255),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_email_connections_user ON email_connections(user_id);
