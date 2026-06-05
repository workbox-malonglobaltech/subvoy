-- FX rates cache table.
-- Stores the latest fetched exchange rate for each currency pair (base → target).
-- The application fetches from Frankfurter API once daily and upserts here.
-- All rates are expressed as: 1 unit of base_currency = rate units of target_currency.

CREATE TABLE IF NOT EXISTS fx_rates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency VARCHAR(3)     NOT NULL,          -- e.g. 'USD'
  target_currency VARCHAR(3)   NOT NULL,          -- e.g. 'NGN'
  rate          NUMERIC(18, 6) NOT NULL,          -- e.g. 1600.250000
  fetched_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT fx_rates_pair_unique UNIQUE (base_currency, target_currency)
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_pair ON fx_rates (base_currency, target_currency);
