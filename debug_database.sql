-- Debug Database State
-- This script will help us understand what's currently in the database

-- Check all profiles
SELECT 
    id,
    full_name,
    email,
    role,
    fica_documents,
    created_at
FROM profiles 
ORDER BY created_at DESC;

-- Check specifically for the problematic ID number
SELECT 
    id,
    full_name,
    email,
    role,
    fica_documents->>'id_number' as id_number,
    created_at
FROM profiles 
WHERE fica_documents->>'id_number' = '7405105163087'
ORDER BY created_at DESC;

-- Count total profiles
SELECT COUNT(*) as total_profiles FROM profiles;

-- Count profiles with FICA documents
SELECT COUNT(*) as profiles_with_fica FROM profiles WHERE fica_documents IS NOT NULL;

-- Count profiles with ID numbers
SELECT COUNT(*) as profiles_with_id_numbers FROM profiles 
WHERE fica_documents->>'id_number' IS NOT NULL; 