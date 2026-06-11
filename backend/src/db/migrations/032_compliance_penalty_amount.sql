-- Migration 032: structured penalty on compliance items.
-- penalty_amount + penalty_currency let users record a monetary late-filing
-- penalty in any currency (penalty_note remains for free-text detail).
ALTER TABLE compliance_items ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC(14,2);
ALTER TABLE compliance_items ADD COLUMN IF NOT EXISTS penalty_currency VARCHAR(3);
