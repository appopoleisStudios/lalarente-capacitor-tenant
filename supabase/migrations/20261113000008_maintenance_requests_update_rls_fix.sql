-- Every UPDATE on maintenance_requests failed with
--   42P17 infinite recursion detected in policy for relation "maintenance_requests"
-- because mr_update's WITH CHECK re-selected the same table (mr2) to compare
-- old vs new values. Permissive policies are OR'ed, so those comparisons were
-- never actually enforced (owner/tenant *_access policies already pass) — they
-- only caused the recursion.
--
-- 1. mr_update: same parties, no self-reference.
-- 2. The real invariant (a request never changes tenant, owner or property)
--    moves to a BEFORE UPDATE trigger, where OLD is available.
-- 3. "Authenticated users can update maintenance requests" was USING (true):
--    any signed-in user could edit any request. Limit it to the people who
--    can see the request (same rule as the SELECT policies).

DROP POLICY IF EXISTS mr_update ON public.maintenance_requests;
CREATE POLICY mr_update ON public.maintenance_requests
  FOR UPDATE TO authenticated
  USING ((tenant_id = auth.uid()) OR (owner_id = auth.uid()))
  WITH CHECK (
    ((tenant_id = auth.uid()) OR (owner_id = auth.uid()))
    AND ((vendor_id IS NULL) OR (captured_tenant_may_dispatch = true) OR (owner_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated users can update maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Request parties can update maintenance requests"
  ON public.maintenance_requests
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR tenant_id = auth.uid()
    OR vendor_id = auth.uid()
    OR selected_vendor_id = auth.uid()
    OR visibility = 'public'
    OR public.vendor_invited_to_request(id)
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR tenant_id = auth.uid()
    OR vendor_id = auth.uid()
    OR selected_vendor_id = auth.uid()
    OR visibility = 'public'
    OR public.vendor_invited_to_request(id)
  );

CREATE OR REPLACE FUNCTION public.maintenance_requests_guard_parties()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.property_id IS DISTINCT FROM OLD.property_id THEN
    RAISE EXCEPTION 'maintenance_requests: tenant, owner and property cannot be changed'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS maintenance_requests_guard_parties ON public.maintenance_requests;
CREATE TRIGGER maintenance_requests_guard_parties
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.maintenance_requests_guard_parties();

-- remove the temporary diagnostic from 20261113000007
DROP FUNCTION IF EXISTS public.tmp_inspect_policies();
