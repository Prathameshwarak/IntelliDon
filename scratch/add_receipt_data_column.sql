ALTER TABLE donations ADD COLUMN IF NOT EXISTS receipt_data JSONB;
-- pdf_url is left in place, just no longer written to.
