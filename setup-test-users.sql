-- Setup Test Users for Lalarente App
-- Run this in Supabase SQL Editor after creating users in Auth

-- Note: First create users in Supabase Dashboard → Authentication → Users
-- Then run this script to set their roles

-- Update owner role
UPDATE profiles 
SET 
  role = 'owner',
  full_name = 'John van der Merwe',
  phone = '+27 82 123 4567'
WHERE email = 'owner@lalarente.co.za';

-- Update tenant role
UPDATE profiles 
SET 
  role = 'tenant',
  full_name = 'Sarah Nkosi',
  phone = '+27 83 234 5678'
WHERE email = 'tenant@lalarente.co.za';

-- Update vendor role
UPDATE profiles 
SET 
  role = 'vendor',
  full_name = 'Mike Botha',
  phone = '+27 84 345 6789'
WHERE email = 'vendor@lalarente.co.za';

-- Verify the updates
SELECT id, email, full_name, role, phone 
FROM profiles 
WHERE email IN (
  'owner@lalarente.co.za',
  'tenant@lalarente.co.za',
  'vendor@lalarente.co.za'
);
