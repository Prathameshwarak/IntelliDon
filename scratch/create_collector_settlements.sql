CREATE TABLE IF NOT EXISTS collector_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id UUID NOT NULL REFERENCES users(id),
  mandal_id UUID NOT NULL REFERENCES mandals(id),
  event_id UUID NOT NULL REFERENCES events(id),
  cash_amount NUMERIC NOT NULL DEFAULT 0,
  online_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  total_donations INT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

ALTER TABLE donations ADD COLUMN IF NOT EXISTS settlement_id UUID REFERENCES collector_settlements(id);
