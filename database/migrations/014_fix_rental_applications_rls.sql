-- Migration: Fix RLS policies for rental_applications table
-- Issue: Tenants cannot submit their own applications
-- Solution: Add proper RLS policies for tenants and owners

-- Enable RLS on rental_applications table
ALTER TABLE rental_applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Tenants can view their own applications" ON rental_applications;
DROP POLICY IF EXISTS "Tenants can create applications" ON rental_applications;
DROP POLICY IF EXISTS "Tenants can update their own draft applications" ON rental_applications;
DROP POLICY IF EXISTS "Tenants can submit their own applications" ON rental_applications;
DROP POLICY IF EXISTS "Owners can view applications for their properties" ON rental_applications;
DROP POLICY IF EXISTS "Owners can update applications for their properties" ON rental_applications;

-- Policy 1: Tenants can view their own applications
CREATE POLICY "Tenants can view their own applications"
ON rental_applications
FOR SELECT
USING (auth.uid() = tenant_id);

-- Policy 2: Tenants can create applications
-- But only if they don't have a pending application or recent rejection
CREATE POLICY "Tenants can create applications"
ON rental_applications
FOR INSERT
WITH CHECK (
  auth.uid() = tenant_id
  AND NOT EXISTS (
    SELECT 1 FROM rental_applications
    WHERE tenant_id = auth.uid()
    AND property_id = rental_applications.property_id
    AND (
      -- No pending applications
      status IN ('draft', 'submitted', 'under_review')
      OR
      -- No approved applications
      status = 'approved'
      OR
      -- No rejections within 3 months
      (status = 'rejected' AND rejected_at > NOW() - INTERVAL '3 months')
    )
  )
);

-- Policy 3: Tenants can update their own applications (any status)
-- This allows submitting (draft -> submitted) and withdrawing
CREATE POLICY "Tenants can update their own applications"
ON rental_applications
FOR UPDATE
USING (auth.uid() = tenant_id);

-- Policy 4: Owners can view applications for their properties
CREATE POLICY "Owners can view applications for their properties"
ON rental_applications
FOR SELECT
USING (auth.uid() = owner_id);

-- Policy 5: Owners can update applications for their properties
-- This allows approving, rejecting, and reviewing
CREATE POLICY "Owners can update applications for their properties"
ON rental_applications
FOR UPDATE
USING (auth.uid() = owner_id);

-- Verify the new policies
DO $$
BEGIN
  RAISE NOTICE '=== RLS Policies on rental_applications table ===';
END $$;

SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'rental_applications'
ORDER BY policyname;

-- Create a helper function to check if tenant can apply
CREATE OR REPLACE FUNCTION can_tenant_apply_for_property(
  p_tenant_id UUID,
  p_property_id UUID
) RETURNS TABLE (
  can_apply BOOLEAN,
  reason TEXT
) AS $$
DECLARE
  v_existing_app RECORD;
BEGIN
  -- Check for existing applications
  SELECT * INTO v_existing_app
  FROM rental_applications
  WHERE tenant_id = p_tenant_id
  AND property_id = p_property_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- No previous application
  IF v_existing_app IS NULL THEN
    RETURN QUERY SELECT TRUE, 'No previous application'::TEXT;
    RETURN;
  END IF;

  -- Check for pending applications
  IF v_existing_app.status IN ('draft', 'submitted', 'under_review') THEN
    RETURN QUERY SELECT FALSE, 'You have a pending application for this property'::TEXT;
    RETURN;
  END IF;

  -- Check for approved applications
  IF v_existing_app.status = 'approved' THEN
    RETURN QUERY SELECT FALSE, 'You already have an approved application for this property'::TEXT;
    RETURN;
  END IF;

  -- Check for recent rejections (within 3 months)
  IF v_existing_app.status = 'rejected' AND v_existing_app.rejected_at IS NOT NULL THEN
    IF v_existing_app.rejected_at > NOW() - INTERVAL '3 months' THEN
      RETURN QUERY SELECT FALSE, 
        'You were rejected for this property. You can reapply after ' || 
        TO_CHAR(v_existing_app.rejected_at + INTERVAL '3 months', 'YYYY-MM-DD')::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Can apply
  RETURN QUERY SELECT TRUE, 'You can apply for this property'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION can_tenant_apply_for_property(UUID, UUID) TO authenticated;

RAISE NOTICE '✅ RLS policies updated successfully';
RAISE NOTICE 'Tenants can now create, view, and submit their applications';
RAISE NOTICE 'Owners can view and update applications for their properties';
RAISE NOTICE '✅ Business rules enforced:';
RAISE NOTICE '  - No duplicate pending applications';
RAISE NOTICE '  - No reapplication if approved';
RAISE NOTICE '  - 3-month waiting period after rejection';
