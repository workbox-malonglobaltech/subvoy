-- Global from day one: admin-managed per-country config.
-- Drives the local-currency display rule and payment-provider routing.
-- Resolution at read time: country_settings row → code fallback.
CREATE TABLE IF NOT EXISTS country_settings (
  country          VARCHAR(2)  PRIMARY KEY,           -- ISO 3166-1 alpha-2
  enabled          BOOLEAN     NOT NULL DEFAULT TRUE,
  currency         VARCHAR(3)  NOT NULL,              -- ISO 4217 local currency
  payment_provider VARCHAR(20) NOT NULL DEFAULT 'stripe', -- 'stripe' | 'paystack'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the initial set. Africa → Paystack; rest → Stripe. Local currency per country;
-- the US is the special case that displays a single currency (USD) only.
INSERT INTO country_settings (country, currency, payment_provider) VALUES
  ('US', 'USD', 'stripe'),
  ('GB', 'GBP', 'stripe'),
  ('CA', 'CAD', 'stripe'),
  ('NG', 'NGN', 'paystack'),
  ('GH', 'GHS', 'paystack'),
  ('KE', 'KES', 'paystack'),
  ('ZA', 'ZAR', 'paystack')
ON CONFLICT (country) DO NOTHING;
