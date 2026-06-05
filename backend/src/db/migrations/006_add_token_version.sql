-- Migration 006: Add token_version to users for JWT revocation on logout
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
