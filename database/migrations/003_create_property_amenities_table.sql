-- Migration: Create property_amenities table
-- Task: 1.3 Create property_amenities table
-- Requirements: 1
-- Date: 2025-11-01

BEGIN;

-- Create property_amenities table
CREATE TABLE IF NOT EXISTS property_amenities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  
  amenity TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT false,
  
  -- Optional: value and unit for amenities with quantities
  value TEXT,
  unit TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique amenity per property
  UNIQUE(property_id, amenity)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_property_amenities_property 
  ON property_amenities(property_id);

CREATE INDEX IF NOT EXISTS idx_property_amenities_amenity 
  ON property_amenities(amenity);

CREATE INDEX IF NOT EXISTS idx_property_amenities_custom 
  ON property_amenities(is_custom);

-- Add comments
COMMENT ON TABLE property_amenities IS 'Stores amenities for properties (normalized from properties.amenities JSON)';
COMMENT ON COLUMN property_amenities.amenity IS 'Amenity name (e.g., parking, pool, gym, pet-friendly)';
COMMENT ON COLUMN property_amenities.is_custom IS 'True if custom amenity not in standard list';
COMMENT ON COLUMN property_amenities.value IS 'Numeric or text value for amenity (e.g., "2" for parking spaces)';
COMMENT ON COLUMN property_amenities.unit IS 'Unit of measurement (e.g., "spaces", "Mbps")';

-- Create validation trigger
CREATE OR REPLACE FUNCTION validate_amenity_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize amenity name
  NEW.amenity := lower(trim(NEW.amenity));
  
  -- Ensure not empty
  IF NEW.amenity = '' THEN
    RAISE EXCEPTION 'Amenity name cannot be empty';
  END IF;
  
  -- Ensure reasonable length
  IF length(NEW.amenity) > 100 THEN
    RAISE EXCEPTION 'Amenity name too long (max 100 characters)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_amenity_before_insert
  BEFORE INSERT OR UPDATE ON property_amenities
  FOR EACH ROW
  EXECUTE FUNCTION validate_amenity_name();

-- Set up Row Level Security (RLS)
ALTER TABLE property_amenities ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view amenities for available properties
CREATE POLICY "Anyone can view amenities for available properties"
  ON property_amenities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_amenities.property_id
      AND properties.status = 'available'
    )
  );

-- Policy: Property owners can view amenities for their properties
CREATE POLICY "Owners can view their property amenities"
  ON property_amenities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_amenities.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Policy: Property owners can insert amenities for their properties
CREATE POLICY "Owners can insert amenities for their properties"
  ON property_amenities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_amenities.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Policy: Property owners can delete amenities for their properties
CREATE POLICY "Owners can delete their property amenities"
  ON property_amenities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_amenities.property_id
      AND properties.owner_id = auth.uid()
    )
  );

COMMIT;

-- Migration function (run separately after table creation)
CREATE OR REPLACE FUNCTION migrate_property_amenities()
RETURNS TABLE(
  migrated_count INTEGER,
  error_count INTEGER,
  properties_processed INTEGER
) AS $$
DECLARE
  prop RECORD;
  amenity_item TEXT;
  total_migrated INTEGER := 0;
  total_errors INTEGER := 0;
  total_properties INTEGER := 0;
BEGIN
  FOR prop IN 
    SELECT id, amenities 
    FROM properties 
    WHERE amenities IS NOT NULL 
    AND jsonb_typeof(amenities) = 'array'
  LOOP
    total_properties := total_properties + 1;
    
    BEGIN
      FOR amenity_item IN 
        SELECT jsonb_array_elements_text(prop.amenities)
      LOOP
        INSERT INTO property_amenities (property_id, amenity)
        VALUES (prop.id, lower(trim(amenity_item)))
        ON CONFLICT (property_id, amenity) DO NOTHING;
        
        GET DIAGNOSTICS total_migrated = ROW_COUNT;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      total_errors := total_errors + 1;
      RAISE NOTICE 'Error migrating amenities for property %: %', prop.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT total_migrated, total_errors, total_properties;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION migrate_property_amenities() IS 'Migrates amenities from properties.amenities JSON to property_amenities table';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ property_amenities table created successfully';
  RAISE NOTICE 'Run SELECT * FROM migrate_property_amenities(); to migrate existing data';
END $$;
