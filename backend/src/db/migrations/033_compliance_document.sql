-- Migration 033: optional document attachment on compliance items.
-- document_path = object path in the Supabase Storage 'compliance-docs' bucket.
-- document_name = original filename for display.
ALTER TABLE compliance_items ADD COLUMN IF NOT EXISTS document_path TEXT;
ALTER TABLE compliance_items ADD COLUMN IF NOT EXISTS document_name TEXT;
