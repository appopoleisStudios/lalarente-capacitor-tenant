-- Migration: Enhance properties table for rental management
-- Task: 1.1 Enhance existing properties table
-- Requirements: 1, 2
-- Date: 2025-11-01

-- STEP 1: Add new enum values (MUST be in separate transaction)
-- Run this first and commit before the rest

DO $$ 
BEGIN
  -- Add 'rented' to the enum if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'rented' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'property_status')
  ) THEN
    ALTER TYPE property_status ADD VALUE 'rented';
    RAISE NOTICE 'Added "rented" to property_status enum';
  END IF;
  
  -- Add 'archived' to the enum if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'archived' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'property_status')
  ) THEN
    ALTER TYPE property_status ADD VALUE 'archived';
    RAISE NOTICE 'Added "archived" to property_status enum';
  END IF;
END $$;

-- ⚠️ IMPORTANT: Enum values are now committed. Continue with main migration.

-- STEP 2: Main migration (can be in transaction)

BEGIN;

-- Add new columns to properties table
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS size_sqm DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS available_from DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS minimum_lease_months INTEGER DEFAULT 12,
  ADD COLUMN IF NOT EXISTS pets_allowed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS smoking_allowed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inquiry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS application_count INTEGER DEFAULT 0;

-- Update existing 'occupied' status to 'rented' (now safe)
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE properties SET status = 'rented' WHERE status = 'occupied';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % properties from "occupied" to "rented"', updated_count;
END $$;

-- Add validation constraints
ALTER TABLE properties 
  ADD CONSTRAINT properties_size_positive 
  CHECK (size_sqm IS NULL OR size_sqm > 0);

ALTER TABLE properties 
  ADD CONSTRAINT properties_minimum_lease_positive 
  CHECK (minimum_lease_months IS NULL OR minimum_lease_months > 0);

-- Add column comments
COMMENT ON COLUMN properties.size_sqm IS 'Property size in square meters';
COMMENT ON COLUMN properties.available_from IS 'Date when property becomes available for rent';
COMMENT ON COLUMN properties.minimum_lease_months IS 'Minimum lease duration in months';
COMMENT ON COLUMN properties.pets_allowed IS 'Whether pets are allowed in the property';
COMMENT ON COLUMN properties.smoking_allowed IS 'Whether smoking is allowed in the property';
COMMENT ON COLUMN properties.view_count IS 'Number of times property has been viewed';
COMMENT ON COLUMN properties.inquiry_count IS 'Number of inquiries received for property';
COMMENT ON COLUMN properties.application_count IS 'Number of applications received for property';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_available_from 
  ON properties(available_from) 
  WHERE status = 'available';

CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_rent_amount ON properties(rent_amount);
CREATE INDEX IF NOT EXISTS idx_properties_bedrooms ON properties(bedrooms);
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON properties(property_type);

CREATE INDEX IF NOT EXISTS idx_properties_filters 
  ON properties(pets_allowed, smoking_allowed) 
  WHERE status = 'available';

-- Create spatial index (conditional on PostGIS)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'earthdistance') THEN
    CREATE INDEX IF NOT EXISTS idx_properties_location 
      ON properties USING GIST (ll_to_earth(latitude, longitude))
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    RAISE NOTICE 'Spatial index created successfully';
  ELSE
    RAISE NOTICE 'PostGIS extension not found. Skipping spatial index.';
  END IF;
END $$;

-- Optimize statistics for query planner
ALTER TABLE properties ALTER COLUMN status SET STATISTICS 1000;
ALTER TABLE properties ALTER COLUMN city SET STATISTICS 1000;
ALTER TABLE properties ALTER COLUMN rent_amount SET STATISTICS 1000;

-- Analyze table to update statistics
ANALYZE properties;

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Properties table enhanced successfully for rental management';
END $$;
