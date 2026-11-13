-- TEMPORARY diagnostic (dropped in 20261113000008): read-only view of the
-- RLS policies on maintenance_requests / properties, to trace
-- "infinite recursion detected in policy for relation maintenance_requests".
CREATE OR REPLACE FUNCTION public.tmp_inspect_policies()
RETURNS TABLE (tablename name, policyname name, cmd text, qual text, with_check text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT p.tablename, p.policyname, p.cmd, p.qual, p.with_check
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN ('maintenance_requests', 'properties')
  ORDER BY p.tablename, p.policyname;
$$;
REVOKE ALL ON FUNCTION public.tmp_inspect_policies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tmp_inspect_policies() TO authenticated;
