-- Migration: Update lease status constraint to support granular signature tracking
-- This allows us to track whether we're waiting for tenant or owner signature

-- Drop the old constraint
ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_status_check;

-- Add new constraint with additional statuses
ALTER TABLE leases 
  ADD CONSTRAINT leases_status_check 
  CHECK (status IN (
    'draft',
    'pending_signatures',      -- Generic: waiting for signatures (legacy)
    'pending_tenant_signature', -- Specific: waiting for tenant to sign
    'pending_owner_signature',  -- Specific: waiting for owner to sign
    'active',
    'expired',
    'terminated'
  ));

-- Update any existing 'pending_signatures' leases to 'pending_tenant_signature'
-- (assuming tenant signs first in the workflow)
UPDATE leases 
SET status = 'pending_tenant_signature'
WHERE status = 'pending_signatures'
  AND tenant_signed_at IS NULL;

-- Update any existing 'pending_signatures' leases to 'pending_owner_signature'
-- (if tenant has already signed)
UPDATE leases 
SET status = 'pending_owner_signature'
WHERE status = 'pending_signatures'
  AND tenant_signed_at IS NOT NULL
  AND owner_signed_at IS NULL;

-- Verify the updates
SELECT 
  id,
  status,
  tenant_signed_at IS NOT NULL as tenant_signed,
  owner_signed_at IS NOT NULL as owner_signed,
  created_at
FROM leases
WHERE status LIKE 'pending%'
ORDER BY created_at DESC;
