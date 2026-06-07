-- Email invitations to a Business workspace. Lets owners/admins invite people who
-- don't yet have a Subvoy account; they accept via a tokenized link (after signup
-- if needed). Existing users can still be added directly via the members API.

DO $$ BEGIN
  CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'revoked');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS workspace_invites (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID           NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email        VARCHAR(255)   NOT NULL,
  role         workspace_role NOT NULL DEFAULT 'member',  -- only 'admin' | 'member' are set
  token        VARCHAR(64)    NOT NULL UNIQUE,
  invited_by   UUID           REFERENCES users(id) ON DELETE SET NULL,
  status       invite_status  NOT NULL DEFAULT 'pending',
  expires_at   TIMESTAMPTZ    NOT NULL,
  accepted_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_ws    ON workspace_invites(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON workspace_invites(email, status);

-- One pending invite per (workspace, email).
CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_invite_pending
  ON workspace_invites(workspace_id, email) WHERE status = 'pending';
