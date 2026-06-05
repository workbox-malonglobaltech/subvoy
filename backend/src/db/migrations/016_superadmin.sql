-- ── Migration 016: Superadmin system ─────────────────────────────────────────
--
-- 1. Add role column to users   (non-locking ADD COLUMN with DEFAULT)
-- 2. Create error_logs table    (structured server error persistence)
-- 3. Create audit_logs table    (admin action trail)
-- 4. Create admin_notifications (system alerts for admin users)
-- 5. Create announcements       (platform-wide broadcasts to users)

-- 1. Role column on users ── default 'user' so no existing row is rewritten
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users
      ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'staff', 'superadmin'));
  END IF;
END $$;

-- Suspended flag — soft-suspension without deleting the account
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'suspended_at'
  ) THEN
    ALTER TABLE users ADD COLUMN suspended_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Structured error log
CREATE TABLE IF NOT EXISTS error_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level        VARCHAR(10)  NOT NULL DEFAULT 'error'
                 CHECK (level IN ('warn', 'error', 'fatal')),
  message      TEXT         NOT NULL,
  stack        TEXT,
  route        VARCHAR(500),
  method       VARCHAR(10),
  status_code  INT,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  context      JSONB,
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created  ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_level     ON error_logs(level);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved  ON error_logs(resolved_at) WHERE resolved_at IS NULL;

-- 3. Admin audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action       VARCHAR(100) NOT NULL,
  target_type  VARCHAR(50),
  target_id    VARCHAR(255),
  details      JSONB,
  ip_address   VARCHAR(45),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin    ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created  ON audit_logs(created_at DESC);

-- 4. Admin notification inbox (system-generated alerts for staff/superadmin)
CREATE TABLE IF NOT EXISTS admin_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         VARCHAR(50)  NOT NULL,
  title        VARCHAR(255) NOT NULL,
  message      TEXT         NOT NULL,
  severity     VARCHAR(10)  NOT NULL DEFAULT 'info'
                 CHECK (severity IN ('info', 'warning', 'critical')),
  metadata     JSONB,
  read_at      TIMESTAMPTZ,
  read_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notif_created ON admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notif_unread  ON admin_notifications(read_at) WHERE read_at IS NULL;

-- 5. Platform announcements (admin → users)
CREATE TABLE IF NOT EXISTS announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by   UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  title        VARCHAR(255) NOT NULL,
  body         TEXT         NOT NULL,
  channel      VARCHAR(10)  NOT NULL DEFAULT 'both'
                 CHECK (channel IN ('in-app', 'email', 'both')),
  target       VARCHAR(20)  NOT NULL DEFAULT 'all'
                 CHECK (target IN ('all', 'active')),
  sent_at      TIMESTAMPTZ,
  recipient_count INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);
