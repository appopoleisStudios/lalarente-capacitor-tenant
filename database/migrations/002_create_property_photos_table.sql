-- Migration: Create property_photos table
-- Task: 1.2 Create property_photos table
-- Requirements: 1
-- Date: 2025-11-01

BEGIN;

-- Create property_photos table
CREATE TABLE IF NOT EXISTS property_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  
  url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  caption TEXT,
  
  -- Additional metadata
  file_size_bytes INTEGER,
  width_px INTEGER,
  height_px INTEGER,
  mime_type TEXT DEFAULT 'image/jpeg',
  storage_path TEXT,
  is_primary BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  UNIQUE(property_id, display_order),
  CHECK (display_order >= 0),
  CHECK (url <> '' AND thumbnail_url <> ''),
  CHECK (file_size_bytes IS NULL OR (file_size_bytes > 0 AND file_size_bytes < 52428800))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_property_photos_property 
  ON property_photos(property_id);

CREATE INDEX IF NOT EXISTS idx_property_photos_display_order 
  ON property_photos(property_id, display_order);

CREATE INDEX IF NOT EXISTS idx_property_photos_not_deleted 
  ON property_photos(property_id) 
  WHERE deleted_at IS NULL;

-- Ensure only one primary photo per property
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_photos_one_primary
  ON property_photos(property_id)
  WHERE is_primary = true AND deleted_at IS NULL;

-- Add comments
COMMENT ON TABLE property_photos IS 'Stores photos for property listings';
COMMENT ON COLUMN property_photos.url IS 'Full-size photo URL in storage';
COMMENT ON COLUMN property_photos.thumbnail_url IS 'Thumbnail version for list views';
COMMENT ON COLUMN property_photos.display_order IS 'Order in which photos should be displayed';
COMMENT ON COLUMN property_photos.caption IS 'Optional caption for the photo';
COMMENT ON COLUMN property_photos.file_size_bytes IS 'File size in bytes';
COMMENT ON COLUMN property_photos.width_px IS 'Original image width in pixels';
COMMENT ON COLUMN property_photos.height_px IS 'Original image height in pixels';
COMMENT ON COLUMN property_photos.mime_type IS 'Image MIME type (image/jpeg, image/png, etc.)';
COMMENT ON COLUMN property_photos.storage_path IS 'Full path in storage bucket for deletion';
COMMENT ON COLUMN property_photos.is_primary IS 'Whether this is the primary/cover photo for the property';

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_property_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_property_photos_updated_at
  BEFORE UPDATE ON property_photos
  FOR EACH ROW
  EXECUTE FUNCTION update_property_photos_updated_at();

-- Create trigger to enforce photo limit
CREATE OR REPLACE FUNCTION check_property_photo_limit()
RETURNS TRIGGER AS $$
DECLARE
  photo_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO photo_count
  FROM property_photos
  WHERE property_id = NEW.property_id
  AND deleted_at IS NULL;
  
  IF photo_count >= 20 THEN
    RAISE EXCEPTION 'Cannot add more than 20 photos per property';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_property_photo_limit
  BEFORE INSERT ON property_photos
  FOR EACH ROW
  EXECUTE FUNCTION check_property_photo_limit();

-- Set up Row Level Security (RLS)
ALTER TABLE property_photos ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view photos for available properties (not deleted)
CREATE POLICY "Anyone can view property photos for available properties"
  ON property_photos FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_photos.property_id
      AND properties.status = 'available'
    )
  );

-- Policy: Property owners can view all photos for their properties
CREATE POLICY "Owners can view their property photos"
  ON property_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_photos.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Policy: Property owners can insert photos for their properties
CREATE POLICY "Owners can insert photos for their properties"
  ON property_photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_photos.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Policy: Property owners can update photos for their properties
CREATE POLICY "Owners can update their property photos"
  ON property_photos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_photos.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Policy: Property owners can delete photos (soft delete by setting deleted_at)
CREATE POLICY "Owners can delete their property photos"
  ON property_photos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_photos.property_id
      AND properties.owner_id = auth.uid()
    )
  )
  WITH CHECK (deleted_at IS NOT NULL);

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ property_photos table created successfully';
END $$;
