-- ============================================
-- Storage Buckets Setup for Rental Management
-- ============================================
-- Run this in your Supabase SQL Editor

BEGIN;

-- Create new storage buckets with file size limits and MIME type restrictions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  ('inspection-photos', 'inspection-photos', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('message-attachments', 'message-attachments', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('id-documents', 'id-documents', false, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf']),
  ('proof-of-income', 'proof-of-income', false, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf']),
  ('signatures', 'signatures', false, 1048576, ARRAY['image/png', 'image/svg+xml']),
  ('profiles', 'profiles', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;

-- ============================================
-- RLS Policies for Storage Buckets
-- ============================================

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
  -- Inspection photos
  DROP POLICY IF EXISTS "Public can view inspection photos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload inspection photos" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own inspection photos" ON storage.objects;
  
  -- Message attachments
  DROP POLICY IF EXISTS "Public can view message attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload message attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own message attachments" ON storage.objects;
  
  -- ID documents
  DROP POLICY IF EXISTS "Users can view their own ID documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload their own ID documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own ID documents" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can view ID documents" ON storage.objects;
  
  -- Proof of income
  DROP POLICY IF EXISTS "Users can view their own proof of income" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload their own proof of income" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own proof of income" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can view proof of income" ON storage.objects;
  
  -- Signatures
  DROP POLICY IF EXISTS "Users can view their own signatures" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload their own signatures" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own signatures" ON storage.objects;
  
  -- Profiles
  DROP POLICY IF EXISTS "Public can view profile images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload their own profile images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;
END $$;

-- 1. INSPECTION_PHOTOS - Public read, authenticated write
CREATE POLICY "Public can view inspection photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'inspection-photos');

CREATE POLICY "Authenticated users can upload inspection photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'inspection-photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own inspection photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'inspection-photos' 
  AND auth.role() = 'authenticated'
);

-- 2. MESSAGE_ATTACHMENTS - Public read, authenticated write
CREATE POLICY "Public can view message attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'message-attachments');

CREATE POLICY "Authenticated users can upload message attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'message-attachments' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own message attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'message-attachments' 
  AND auth.role() = 'authenticated'
);

-- 3. ID_DOCUMENTS - Private (only owner and property owners/admins can access)
CREATE POLICY "Users can view their own ID documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'id-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view ID documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'id-documents'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Users can upload their own ID documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'id-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own ID documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'id-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. PROOF_OF_INCOME - Private (only owner and property owners/admins can access)
CREATE POLICY "Users can view their own proof of income"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'proof-of-income' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view proof of income"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'proof-of-income'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Users can upload their own proof of income"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'proof-of-income' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own proof of income"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'proof-of-income' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. SIGNATURES - Private (only owner can access)
CREATE POLICY "Users can view their own signatures"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'signatures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own signatures"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'signatures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own signatures"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'signatures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 6. PROFILES - Public read, owner write
CREATE POLICY "Public can view profile images"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles');

CREATE POLICY "Users can upload their own profile images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profiles' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own profile images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profiles' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profiles' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- Verification Query
-- ============================================
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id IN (
  'inspection-photos',
  'message-attachments',
  'id-documents',
  'proof-of-income',
  'signatures',
  'profiles'
)
ORDER BY name;
