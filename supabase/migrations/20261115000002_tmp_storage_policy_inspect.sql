-- Temporary diagnostic (dropped in the next migration): list storage.objects
-- policies so the remaining broad read access on `contracts` can be found.
CREATE OR REPLACE FUNCTION public.tmp_storage_policies()
RETURNS TABLE (policyname name, cmd text, roles text, qual text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT p.policyname, p.cmd, p.roles::text, p.qual
  FROM pg_policies p WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
  ORDER BY p.policyname;
$$;
REVOKE ALL ON FUNCTION public.tmp_storage_policies() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tmp_storage_policies() TO authenticated;
