-- Migration: Allow owners to view vendor profiles for contracts they own
-- This fixes the "Unknown vendor" issue in the owner contracts page

-- Add RLS policy for owners to view vendor profiles
CREATE POLICY "Owners can view vendor profiles" ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM service_contracts 
    WHERE service_contracts.vendor_id = profiles.id 
    AND service_contracts.owner_id = auth.uid()
  )
);
