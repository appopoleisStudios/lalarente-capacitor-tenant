-- Set up storage policies for lease signatures and contracts
-- Run this in Supabase SQL Editor
--
-- NOTE: This uses your EXISTING buckets:
-- - 'signatures' bucket (for PNG signature images)
-- - 'contracts' bucket (for signed lease PDF contracts)
--
-- No new buckets are created!
-- The 'documents' bucket is left untouched (used for owner/tenant/vendor business documents)

-- Drop existing policies first (if they exist)
DROP POLICY IF EXISTS "Users can upload lease signatures" ON storage.objects;
DROP POLICY IF EXISTS "Users can view lease signatures" ON storage.objects;
DROP POLICY IF EXISTS "Public can view lease signatures" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload lease contracts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view lease contracts" ON storage.objects;
DROP POLICY IF EXISTS "Public can view lease contracts" ON storage.objects;

-- 1. Set up storage policies for signatures bucket (lease signatures)

-- Allow authenticated users to upload their own lease signatures
CREATE POLICY "Users can upload lease signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'signatures' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM leases 
    WHERE owner_id = auth.uid() OR tenant_id = auth.uid()
  )
);

-- Allow authenticated users to read lease signatures
CREATE POLICY "Users can view lease signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'signatures' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM leases 
    WHERE owner_id = auth.uid() OR tenant_id = auth.uid()
  )
);

-- Allow public read access (for displaying signatures in app)
CREATE POLICY "Public can view lease signatures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'signatures');

-- 2. Set up storage policies for contracts bucket (lease PDF contracts)

-- Allow authenticated users to upload lease contracts
CREATE POLICY "Users can upload lease contracts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contracts' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM leases 
    WHERE owner_id = auth.uid() OR tenant_id = auth.uid()
  )
);

-- Allow authenticated users to read lease contracts
CREATE POLICY "Users can view lease contracts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contracts' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM leases 
    WHERE owner_id = auth.uid() OR tenant_id = auth.uid()
  )
);

-- Allow public read access (for downloading signed lease contracts)
CREATE POLICY "Public can view lease contracts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'contracts');
