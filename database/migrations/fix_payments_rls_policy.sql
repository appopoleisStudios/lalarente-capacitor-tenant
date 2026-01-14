-- Fix payments RLS policy to allow lease execution to create first payment
-- Run this in Supabase SQL Editor

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert their own payments" ON payments;
DROP POLICY IF EXISTS "Owners and tenants can insert payments" ON payments;
DROP POLICY IF EXISTS "System can create payments" ON payments;

-- Allow owners to create payments for their properties
CREATE POLICY "Owners can create payments for their properties"
ON payments FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
);

-- Allow tenants to create payments for their leases
CREATE POLICY "Tenants can create payments for their leases"
ON payments FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = auth.uid()
);

-- If the policies above don't work, use this more permissive one:
-- CREATE POLICY "Authenticated users can create payments"
-- ON payments FOR INSERT
-- TO authenticated
-- WITH CHECK (true);
