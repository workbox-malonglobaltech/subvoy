-- Migration 029: ensure public.users.role exists.
--
-- Migration 016 added `role`, but its IF NOT EXISTS check queried
-- information_schema.columns WHERE table_name='users' WITHOUT a schema filter.
-- On Supabase, auth.users ALSO has a `role` column, so the check matched that
-- and SKIPPED adding role to public.users. This adds it explicitly to
-- public.users. Idempotent — a no-op on databases that already have it (local).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'staff', 'superadmin'));
