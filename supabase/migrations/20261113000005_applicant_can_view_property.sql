-- Applicants keep read access to a property once it leaves the public listing.
-- After a holding deposit is paid the property status becomes 'holding_deposit',
-- and tenant RLS only exposed listed properties (or ones they lease), so the
-- tenant who had just secured it saw a blank "Property" on their deposit,
-- application and lease screens.
--
-- SECURITY DEFINER helper (same pattern as is_tenant_of_property) so this
-- policy does not recurse through rental_applications / holding_deposits RLS,
-- which themselves check properties.owner_id.

CREATE OR REPLACE FUNCTION public.is_applicant_of_property(p_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
           SELECT 1 FROM rental_applications
           WHERE property_id = p_property_id AND tenant_id = auth.uid()
         )
      OR EXISTS (
           SELECT 1 FROM holding_deposits
           WHERE property_id = p_property_id AND tenant_id = auth.uid()
         );
$$;

REVOKE ALL ON FUNCTION public.is_applicant_of_property(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_applicant_of_property(uuid) TO authenticated;

DROP POLICY IF EXISTS "Applicants can view properties they applied for" ON public.properties;
CREATE POLICY "Applicants can view properties they applied for"
  ON public.properties
  FOR SELECT
  TO authenticated
  USING (public.is_applicant_of_property(id));
