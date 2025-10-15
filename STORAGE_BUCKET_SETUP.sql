-- ============================================
-- SUPABASE STORAGE BUCKET SETUP
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Create the bucket (if not already created via UI)
INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-media', 'maintenance-media', true)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Drop existing policies (if any)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to maintenance-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own files" ON storage.objects;

-- Step 3: Create RLS policies for maintenance-media bucket

-- Policy 1: Allow PUBLIC read access (so images can be viewed)
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'maintenance-media');

-- Policy 2: Allow AUTHENTICATED users to upload to maintenance-media
CREATE POLICY "Allow authenticated uploads to maintenance-media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'maintenance-media' 
  AND auth.role() = 'authenticated'
);

-- Policy 3: Allow users to UPDATE their own files (optional)
CREATE POLICY "Allow users to update own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'maintenance-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'maintenance-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Allow users to DELETE their own files (optional)
CREATE POLICY "Allow users to delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'maintenance-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Step 4: Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND policyname LIKE '%maintenance%'
ORDER BY policyname;

-- Step 5: Test bucket access
SELECT 
  id,
  name,
  public,
  created_at
FROM storage.buckets
WHERE id = 'maintenance-media';

-- ============================================
-- ALTERNATIVE: More permissive policies (for testing)
-- Use these if you want to allow all authenticated users
-- to upload/delete any files in maintenance-media
-- ============================================

-- Drop the restrictive policies first
-- DROP POLICY IF EXISTS "Allow users to update own files" ON storage.objects;
-- DROP POLICY IF EXISTS "Allow users to delete own files" ON storage.objects;

-- Allow any authenticated user to upload
-- CREATE POLICY "Allow all authenticated uploads"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'maintenance-media' 
--   AND auth.role() = 'authenticated'
-- );

-- Allow any authenticated user to update
-- CREATE POLICY "Allow all authenticated updates"
-- ON storage.objects FOR UPDATE
-- USING (
--   bucket_id = 'maintenance-media' 
--   AND auth.role() = 'authenticated'
-- );

-- Allow any authenticated user to delete
-- CREATE POLICY "Allow all authenticated deletes"
-- ON storage.objects FOR DELETE
-- USING (
--   bucket_id = 'maintenance-media' 
--   AND auth.role() = 'authenticated'
-- );

-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- Check if user is authenticated
-- SELECT auth.uid(), auth.role();

-- Check existing policies
-- SELECT * FROM pg_policies WHERE tablename = 'objects';

-- Check bucket configuration
-- SELECT * FROM storage.buckets WHERE id = 'maintenance-media';

-- Test upload permissions (replace with your user ID)
-- SELECT 
--   bucket_id = 'maintenance-media' AND auth.role() = 'authenticated'
-- FROM storage.objects
-- LIMIT 1;
