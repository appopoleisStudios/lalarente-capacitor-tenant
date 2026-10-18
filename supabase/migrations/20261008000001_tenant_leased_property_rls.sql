-- Allow tenants to read properties they have (or had) a lease on.
-- Without this, property joins from leases return null once a property
-- status changes from 'available' (e.g., to 'rented'), breaking the
-- tenant dashboard, lease screen, arrears, deposit, and other screens.

DROP POLICY IF EXISTS "Tenants can view their leased property" ON properties;

CREATE POLICY "Tenants can view their leased property"
ON properties
FOR SELECT
USING (
  id IN (
    SELECT property_id FROM leases
    WHERE tenant_id = auth.uid()
      AND status IN (
        'active',
        'pending_tenant_signature',
        'pending_owner_signature',
        'expired',
        'terminated',
        'early_terminated'
      )
  )
);
