-- Migration: Fix properties with missing owner profiles
-- This identifies and optionally fixes properties that reference non-existent profiles

-- STEP 1: Check for properties with missing owner profiles
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM properties p
  LEFT JOIN profiles pr ON p.owner_id = pr.id
  WHERE pr.id IS NULL;
  
  RAISE NOTICE '⚠️ Found % properties with missing owner profiles', missing_count;
END $$;

-- STEP 2: List all properties with missing owners (for debugging)
SELECT 
  p.id as property_id,
  p.title,
  p.owner_id as missing_owner_id,
  p.created_at
FROM properties p
LEFT JOIN profiles pr ON p.owner_id = pr.id
WHERE pr.id IS NULL
ORDER BY p.created_at DESC;

-- STEP 3: Option A - Create missing profiles (UNCOMMENT TO USE)
-- This creates basic profiles for missing owner_ids
/*
INSERT INTO profiles (id, full_name, email, role, onboarding_owner_done)
SELECT DISTINCT 
  p.owner_id,
  'Property Owner (Auto-created)',
  NULL,
  'owner',
  false
FROM properties p
LEFT JOIN profiles pr ON p.owner_id = pr.id
WHERE pr.id IS NULL
ON CONFLICT (id) DO NOTHING;
*/

-- STEP 4: Option B - Update properties to use a default owner (UNCOMMENT TO USE)
-- First, create a default "System Owner" profile if it doesn't exist
/*
INSERT INTO profiles (id, full_name, email, role, onboarding_owner_done)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'System Owner',
  'system@lalarente.com',
  'owner',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Then update orphaned properties to use this default owner
UPDATE properties
SET owner_id = '00000000-0000-0000-0000-000000000000'
WHERE owner_id NOT IN (SELECT id FROM profiles);
*/

-- STEP 5: Add a check constraint to prevent this in the future (OPTIONAL)
-- This ensures owner_id always references an existing profile
-- Note: This is already enforced by the foreign key constraint
-- ALTER TABLE properties 
-- ADD CONSTRAINT properties_owner_exists 
-- CHECK (owner_id IN (SELECT id FROM profiles));

RAISE NOTICE '✅ Migration complete. Review the results above and choose Option A or B if needed.';
