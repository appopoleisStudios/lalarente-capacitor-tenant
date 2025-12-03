-- Migration: Fix RLS policies to allow tenants to view property owner profiles
-- Issue: Tenants cannot see owner information when viewing properties
-- Solution: Allow users to read basic profile info of property owners

-- First, check existing policies
DO $$
BEGIN
  RAISE NOTICE '=== Existing RLS Policies on profiles table ===';
END $$;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- Enable RLS on profiles table if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing problematic policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Tenants can view owner profiles" ON profiles;

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id);

-- Policy 3: Users can insert their own profile (for signup)
CREATE POLICY "Users can insert their own profile"
ON profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Policy 4: Allow authenticated users to view basic info of property owners
-- This allows tenants to see owner names when viewing properties
CREATE POLICY "Authenticated users can view owner profiles"
ON profiles
FOR SELECT
USING (
  auth.role() = 'authenticated' 
  AND role = 'owner'
);

-- Policy 5: Allow authenticated users to view vendor profiles
-- This allows owners/tenants to see vendor names for maintenance
CREATE POLICY "Authenticated users can view vendor profiles"
ON profiles
FOR SELECT
USING (
  auth.role() = 'authenticated' 
  AND role = 'vendor'
);

-- Verify the new policies
DO $$
BEGIN
  RAISE NOTICE '=== New RLS Policies on profiles table ===';
END $$;

SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

RAISE NOTICE '✅ RLS policies updated successfully';
RAISE NOTICE 'Tenants can now view owner and vendor profiles';
