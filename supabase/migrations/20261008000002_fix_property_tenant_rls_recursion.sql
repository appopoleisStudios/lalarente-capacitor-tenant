-- Fix circular RLS recursion between properties and leases tables.
--
-- Problem: "Tenants can view their leased property" policy queries leases,
-- and "leases_party_read" policy queries properties. PostgreSQL breaks the
-- cycle by disabling RLS on the inner query, so the leases subquery in the
-- properties policy sees nothing and returns empty -- blank property titles.
--
-- Fix: replace the inline subquery with a SECURITY DEFINER function that
-- bypasses the inner RLS (safely: WHERE tenant_id = auth.uid() still
-- restricts to the calling tenant's own leases).

CREATE OR REPLACE FUNCTION is_tenant_of_property(prop_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM leases
    WHERE property_id = prop_id
      AND tenant_id = auth.uid()
      AND status IN (
        'active',
        'pending_tenant_signature',
        'pending_owner_signature',
        'expired',
        'terminated',
        'early_terminated'
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Tenants can view their leased property" ON properties;

CREATE POLICY "Tenants can view their leased property"
ON properties
FOR SELECT
USING (is_tenant_of_property(id));
