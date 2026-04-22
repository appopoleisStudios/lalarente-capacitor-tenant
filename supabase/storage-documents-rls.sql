-- ============================================================
-- Storage RLS: documents bucket
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================
-- Ensures the `documents` bucket exists as PRIVATE and that
-- only authenticated users can upload/read their own files.
-- Owners can read files belonging to their tenants.
-- ============================================================

-- 1. Create bucket if not present (private = no public URL access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  20971520, -- 20 MB
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 20971520,
      allowed_mime_types = ARRAY[
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
        'application/pdf'
      ];

-- 2. Drop any existing policies on the documents bucket
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload to documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can read their own documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
  DROP POLICY IF EXISTS "Owners can read tenant documents" ON storage.objects;
END $$;

-- 3. Upload: authenticated users can upload into their own folder
CREATE POLICY "Authenticated users can upload to documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
);

-- 4. Read: uploader can always read their own files
--    Owner can read files in folders belonging to their tenants
CREATE POLICY "Users can read their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND (
    -- uploader owns the folder (path starts with their UID)
    (storage.foldername(name))[2] = auth.uid()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
    -- owner of a lease can see tenant documents
    OR EXISTS (
      SELECT 1 FROM leases l
      JOIN profiles p ON p.id = auth.uid()
      WHERE p.role = 'owner'
        AND l.owner_id = auth.uid()
        AND (storage.foldername(name))[2] = l.tenant_id::text
    )
  )
);

-- 5. Delete: users can delete their own files only
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);
