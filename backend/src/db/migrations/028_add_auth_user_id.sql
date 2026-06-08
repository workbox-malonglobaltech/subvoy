-- Phase A (Supabase Auth): link each domain user to its Supabase identity.
-- Nullable + unique so the legacy password/cookie path keeps working during the
-- migration; populated on first Supabase login (matched by email) or at signup.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
