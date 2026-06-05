CREATE TABLE IF NOT EXISTS user_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_user_categories_user_id ON user_categories(user_id);
