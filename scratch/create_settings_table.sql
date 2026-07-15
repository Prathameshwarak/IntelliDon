-- Migration: Create system_settings table for global configurations
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default subscription UPI ID if not present
INSERT INTO system_settings (key, value)
VALUES ('subscription_upi_id', 'intellidon@upi')
ON CONFLICT (key) DO NOTHING;
