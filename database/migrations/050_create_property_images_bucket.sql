-- ============================================================
-- MIGRATION 050: Create property-images storage bucket
-- ============================================================
-- The property-images bucket was never created in the original
-- storage setup (migration 037 / storage-buckets-setup.sql).
-- This migration adds it with public read access so property
-- photos display correctly in tenant and owner detail screens.
-- ============================================================

-- Create bucket (public = true so getPublicUrl works without auth)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  true,
  52428800, -- 50MB per image
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS: Public read access (anyone can view property images)
DROP POLICY IF EXISTS "Public can view property images" ON storage.objects;
CREATE POLICY "Public can view property images"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-images');

-- RLS: Authenticated users can upload property images
DROP POLICY IF EXISTS "Authenticated users can upload property images" ON storage.objects;
CREATE POLICY "Authenticated users can upload property images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'property-images'
  AND auth.role() = 'authenticated'
);

-- RLS: Users can update their own property images
DROP POLICY IF EXISTS "Authenticated users can update property images" ON storage.objects;
CREATE POLICY "Authenticated users can update property images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'property-images'
  AND auth.role() = 'authenticated'
);

-- RLS: Users can delete their own property images
DROP POLICY IF EXISTS "Authenticated users can delete property images" ON storage.objects;
CREATE POLICY "Authenticated users can delete property images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'property-images'
  AND auth.role() = 'authenticated'
);

-- Verify bucket was created
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'property-images';
