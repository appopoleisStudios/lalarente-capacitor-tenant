-- Drop existing tables first
DROP TABLE IF EXISTS inspection_photos CASCADE;
DROP TABLE IF EXISTS inspections CASCADE;
DROP TABLE IF EXISTS key_handovers CASCADE;

-- Now create fresh
BEGIN;

CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  lease_id UUID REFERENCES leases(id),
  
  type TEXT NOT NULL CHECK (type IN ('move_in', 'periodic', 'move_out')),
  
  scheduled_date TIMESTAMPTZ NOT NULL,
  completed_date TIMESTAMPTZ,
  
  owner_id UUID NOT NULL REFERENCES profiles(id),
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  inspector_id UUID REFERENCES profiles(id),
  
  rooms JSONB NOT NULL DEFAULT '[]'::jsonb,
  overall_condition TEXT CHECK (overall_condition IN ('excellent', 'good', 'fair', 'poor')),
  notes TEXT,
  
  owner_signed_at TIMESTAMPTZ,
  tenant_signed_at TIMESTAMPTZ,
  owner_signature_url TEXT,
  tenant_signature_url TEXT,
  
  report_url TEXT,
  
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inspections_property ON inspections(property_id);
CREATE INDEX idx_inspections_lease ON inspections(lease_id);
CREATE INDEX idx_inspections_owner ON inspections(owner_id);
CREATE INDEX idx_inspections_tenant ON inspections(tenant_id);
CREATE INDEX idx_inspections_type ON inspections(type);
CREATE INDEX idx_inspections_status ON inspections(status);
CREATE INDEX idx_inspections_scheduled_date ON inspections(scheduled_date);

COMMENT ON TABLE inspections IS 'Stores property inspections';

CREATE TABLE inspection_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  
  room_name TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  caption TEXT,
  issue_severity TEXT CHECK (issue_severity IN ('minor', 'moderate', 'major')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inspection_photos_inspection ON inspection_photos(inspection_id);
CREATE INDEX idx_inspection_photos_room ON inspection_photos(room_name);

COMMENT ON TABLE inspection_photos IS 'Stores photos from inspections';

CREATE TABLE key_handovers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id),
  
  type TEXT NOT NULL CHECK (type IN ('move_in', 'move_out')),
  
  physical_keys JSONB DEFAULT '[]'::jsonb,
  access_cards JSONB DEFAULT '[]'::jsonb,
  access_codes JSONB DEFAULT '[]'::jsonb,
  
  handed_over_by UUID NOT NULL REFERENCES profiles(id),
  received_by UUID NOT NULL REFERENCES profiles(id),
  handover_date TIMESTAMPTZ NOT NULL,
  signature_url TEXT,
  
  returned_date TIMESTAMPTZ,
  missing_items TEXT[],
  replacement_cost DECIMAL(10, 2) DEFAULT 0 CHECK (replacement_cost >= 0),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_key_handovers_property ON key_handovers(property_id);
CREATE INDEX idx_key_handovers_lease ON key_handovers(lease_id);
CREATE INDEX idx_key_handovers_type ON key_handovers(type);

COMMENT ON TABLE key_handovers IS 'Tracks key handovers';

-- Trigger functions
CREATE OR REPLACE FUNCTION check_inspection_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_signed_at IS NOT NULL 
     AND NEW.tenant_signed_at IS NOT NULL 
     AND NEW.status != 'completed' THEN
    NEW.status = 'completed';
    NEW.completed_date = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_inspections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_inspection_completion_trigger ON inspections;
CREATE TRIGGER check_inspection_completion_trigger
  BEFORE UPDATE ON inspections
  FOR EACH ROW
  EXECUTE FUNCTION check_inspection_completion();

DROP TRIGGER IF EXISTS inspections_updated_at ON inspections;
CREATE TRIGGER inspections_updated_at
  BEFORE UPDATE ON inspections
  FOR EACH ROW
  EXECUTE FUNCTION update_inspections_updated_at();

COMMIT;

-- Add RLS to inspections, inspection_photos, key_handovers
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_handovers ENABLE ROW LEVEL SECURITY;

-- Create policies (similar pattern as before)
