-- Phase 2: plan catalog. Drives the pricing/upgrade UI and maps to workspaces.plan
-- + the plan_limits registry. Prices are placeholders (minor units) and tunable;
-- price_minor = 0 means free, interval NULL for free tiers.

CREATE TABLE IF NOT EXISTS plans (
  key          VARCHAR(30)  PRIMARY KEY,           -- matches workspaces.plan + plan_limits.plan
  display_name VARCHAR(60)  NOT NULL,
  audience     VARCHAR(20)  NOT NULL,              -- 'personal' | 'business'
  price_minor  INTEGER      NOT NULL DEFAULT 0,    -- in minor units of `currency`
  currency     VARCHAR(3)   NOT NULL DEFAULT 'USD',
  interval     VARCHAR(10),                        -- 'month' | 'year' | NULL (free)
  features     TEXT[]       NOT NULL DEFAULT '{}',
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO plans (key, display_name, audience, price_minor, currency, interval, features, sort_order) VALUES
  ('free',     'Free',     'personal', 0,    'USD', NULL,    ARRAY['Track up to 10 subscriptions','Reminders','Calendar'], 1),
  ('plus',     'Plus',     'personal', 250,  'USD', 'month', ARRAY['Unlimited subscriptions','Pay-for-you autopay','Price-change alerts','Multi-currency','Priority reminders'], 2),
  ('business_free', 'Free', 'business', 0,   'USD', NULL,    ARRAY['1 workspace','Up to 10 obligations','2 members'], 1),
  ('team',     'Team',     'business', 1200, 'USD', 'month', ARRAY['Unlimited obligations','Up to 10 members','Roles + audit log','Custom reminder cadences','Compliance tracking'], 2),
  ('business', 'Business', 'business', 4000, 'USD', 'month', ARRAY['Everything in Team','Do-for-you (coming soon)','API access','SSO','Priority support'], 3)
ON CONFLICT (key) DO NOTHING;
