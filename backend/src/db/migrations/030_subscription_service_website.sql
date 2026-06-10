-- Migration 030: richer subscription fields.
-- service  = what the subscription provides (e.g. "Hosting", "Streaming")
-- website  = the service's web address (e.g. "namecheap.com")
-- (name remains the service/business name, e.g. "Namecheap".)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS service TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS website TEXT;
