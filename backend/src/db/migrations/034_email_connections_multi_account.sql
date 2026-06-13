-- Allow multiple email accounts per provider (e.g. two different Gmail addresses).
-- Was UNIQUE(user_id, provider) — which let one Gmail overwrite another. Now the
-- account's email is part of the key, so several accounts per provider coexist.
ALTER TABLE email_connections DROP CONSTRAINT IF EXISTS email_connections_user_id_provider_key;

ALTER TABLE email_connections
  ADD CONSTRAINT email_connections_user_provider_email_key UNIQUE (user_id, provider, email);
