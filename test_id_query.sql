-- Test script to verify ID number query works
-- Run this in Supabase Dashboard to see if the query can find the existing ID numbers

-- Test 1: Direct query for the specific ID number
SELECT 
    id,
    full_name,
    email,
    role,
    fica_documents,
    fica_documents->>'id_number' as extracted_id_number,
    created_at
FROM profiles 
WHERE fica_documents->>'id_number' = '7405105163087'
ORDER BY created_at DESC;

-- Test 2: Check all profiles with any ID number
SELECT 
    id,
    full_name,
    email,
    role,
    fica_documents->>'id_number' as id_number,
    created_at
FROM profiles 
WHERE fica_documents->>'id_number' IS NOT NULL
    AND fica_documents->>'id_number' != ''
ORDER BY created_at DESC;

-- Test 3: Count profiles with ID numbers
SELECT 
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN fica_documents->>'id_number' IS NOT NULL THEN 1 END) as profiles_with_id_numbers,
    COUNT(CASE WHEN fica_documents->>'id_number' = '7405105163087' THEN 1 END) as profiles_with_target_id
FROM profiles; 