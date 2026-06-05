-- Add Google OAuth support: store google_id per user, allow null password_hash for OAuth users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) DEFAULT NULL,
  ALTER COLUMN password_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
