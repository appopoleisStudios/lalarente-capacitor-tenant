-- Comprehensive Profile Debugging
-- This script will help us understand what's in the profiles table

-- 1. Check all profiles with detailed information
SELECT 
    id,
    full_name,
    email,
    role,
    verification_status,
    created_at,
    updated_at,
    fica_documents,
    CASE 
        WHEN fica_documents IS NULL THEN 'NULL'
        WHEN fica_documents = 'null' THEN 'STRING NULL'
        WHEN fica_documents = '{}' THEN 'EMPTY OBJECT'
        ELSE 'HAS DATA'
    END as fica_status,
    CASE 
        WHEN fica_documents->>'id_number' IS NULL THEN 'NULL'
        WHEN fica_documents->>'id_number' = '' THEN 'EMPTY'
        ELSE fica_documents->>'id_number'
    END as extracted_id_number
FROM profiles 
ORDER BY created_at DESC;

-- 2. Check specifically for the problematic ID number
SELECT 
    id,
    full_name,
    email,
    role,
    fica_documents,
    fica_documents->>'id_number' as id_number,
    created_at
FROM profiles 
WHERE fica_documents->>'id_number' = '7405105163087'
ORDER BY created_at DESC;

-- 3. Check for any profiles with FICA documents
SELECT 
    id,
    full_name,
    email,
    role,
    fica_documents,
    created_at
FROM profiles 
WHERE fica_documents IS NOT NULL 
    AND fica_documents != 'null'
    AND fica_documents != '{}'
ORDER BY created_at DESC;

-- 4. Check for profiles with ID numbers (any ID number)
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

-- 5. Count summary
SELECT 
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN fica_documents IS NOT NULL THEN 1 END) as profiles_with_fica,
    COUNT(CASE WHEN fica_documents->>'id_number' IS NOT NULL THEN 1 END) as profiles_with_id_numbers,
    COUNT(CASE WHEN fica_documents->>'id_number' = '7405105163087' THEN 1 END) as profiles_with_target_id
FROM profiles;

-- 6. Check for the specific email
SELECT 
    id,
    full_name,
    email,
    role,
    created_at
FROM profiles 
WHERE email = 'indraj.navin@gmail.com'
ORDER BY created_at DESC; 