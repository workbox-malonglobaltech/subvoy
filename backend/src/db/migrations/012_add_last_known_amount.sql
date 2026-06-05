-- Tracks the last billed amount for each subscription so we can detect price changes.
-- Backfilled from the current `amount` column so existing subscriptions don't
-- trigger a spurious alert on the first scan after this migration runs.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_known_amount NUMERIC(10, 2) DEFAULT NULL;

-- Backfill: set last_known_amount = amount for all existing rows
UPDATE subscriptions SET last_known_amount = amount WHERE last_known_amount IS NULL;
