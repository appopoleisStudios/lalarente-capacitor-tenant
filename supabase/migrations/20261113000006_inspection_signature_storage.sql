-- Inspection sign-off stores signatures at signatures/{inspection_id}/{role}.png
-- (shared uploadSignature helper). The signatures bucket only allowed lease /
-- user folders, so signing an inspection failed with
--   "Failed to upload signature: new row violates row-level security policy".
-- Allow the inspection's owner, tenant or inspector to write in its folder.

CREATE OR REPLACE FUNCTION public.is_party_to_inspection(p_inspection_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM inspections i
    WHERE i.id::text = p_inspection_id
      AND auth.uid() IN (i.owner_id, i.tenant_id, i.inspector_id)
  );
$$;

REVOKE ALL ON FUNCTION public.is_party_to_inspection(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_party_to_inspection(text) TO authenticated;

DROP POLICY IF EXISTS "Inspection parties can upload signatures" ON storage.objects;
CREATE POLICY "Inspection parties can upload signatures"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'signatures'
    AND public.is_party_to_inspection((storage.foldername(name))[1])
  );

-- upsert: true needs UPDATE (and SELECT on the existing row) as well
DROP POLICY IF EXISTS "Inspection parties can update signatures" ON storage.objects;
CREATE POLICY "Inspection parties can update signatures"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'signatures'
    AND public.is_party_to_inspection((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "Inspection parties can view signatures" ON storage.objects;
CREATE POLICY "Inspection parties can view signatures"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'signatures'
    AND public.is_party_to_inspection((storage.foldername(name))[1])
  );
