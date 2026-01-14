-- STEP 1: Run the migration first to update the constraint
-- Execute: lalarente-app/database/migrations/017_update_lease_status_constraint.sql

-- STEP 2: Then this will work (or it will be done automatically by the migration)
-- Fix the status of the existing lease from 'pending_signatures' to 'pending_tenant_signature'
UPDATE leases 
SET status = 'pending_tenant_signature'
WHERE id = '2370f69c-eb64-461d-a721-07c626929984';

-- Verify the update
SELECT id, status, tenant_signed_at, owner_signed_at, created_at
FROM leases
WHERE id = '2370f69c-eb64-461d-a721-07c626929984';
