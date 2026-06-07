-- Multi-tenancy foundation: workspaces + members.
--
-- A user has exactly one Personal workspace (auto-created) and may own/join any
-- number of Business workspaces. Workspace TYPE drives capabilities (personal =
-- payments only; business = payments + compliance + teams). Obligations and all
-- other user data become workspace-scoped in later migrations.
--
-- Global support: users carry country + timezone so reminders fire in local time
-- and country-specific settings (currency, payment provider) can be applied.

-- ── Global fields on users ────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS country  VARCHAR(2),               -- ISO 3166-1 alpha-2, nullable
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64);              -- IANA tz, e.g. 'Africa/Lagos'

-- ── Workspaces ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE workspace_type AS ENUM ('personal', 'business');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS workspaces (
  id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  type       workspace_type NOT NULL DEFAULT 'personal',
  name       VARCHAR(120)   NOT NULL,
  owner_id   UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country    VARCHAR(2),                                       -- workspace operating country (business)
  plan       VARCHAR(30)    NOT NULL DEFAULT 'free',           -- billing plan key
  created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);

-- At most one Personal workspace per user (Business workspaces are unlimited).
CREATE UNIQUE INDEX IF NOT EXISTS uq_workspaces_personal_per_user
  ON workspaces(owner_id) WHERE type = 'personal';

-- ── Workspace members ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS workspace_members (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID           NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         workspace_role NOT NULL DEFAULT 'member',
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user      ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);

-- ── Backfill: give every existing user a Personal workspace + owner membership ──
INSERT INTO workspaces (type, name, owner_id)
SELECT 'personal', 'Personal', u.id
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces w WHERE w.owner_id = u.id AND w.type = 'personal'
);

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'
FROM workspaces w
WHERE w.type = 'personal'
  AND NOT EXISTS (
    SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = w.owner_id
  );
