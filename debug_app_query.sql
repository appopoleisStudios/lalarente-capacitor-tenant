-- Debug script to test the exact query the app is using
-- This simulates what checkIdNumberExists function does

-- Test 1: Simulate the app's query exactly
-- The app uses: .eq('fica_documents->id_number', idNumber)
-- This translates to SQL like:
SELECT 
    id,
    full_name,
    email,
    fica_documents,
    fica_documents->>'id_number' as extracted_id_number
FROM profiles 
WHERE fica_documents->>'id_number' = '7405105163087';

-- Test 2: Check if there are any profiles with FICA documents at all
SELECT 
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN fica_documents IS NOT NULL THEN 1 END) as profiles_with_fica,
    COUNT(CASE WHEN fica_documents->>'id_number' IS NOT NULL THEN 1 END) as profiles_with_id_numbers
FROM profiles;

-- Test 3: Show all profiles with their FICA documents
SELECT 
    id,
    full_name,
    email,
    fica_documents,
    CASE 
        WHEN fica_documents IS NULL THEN 'NULL'
        WHEN fica_documents = 'null' THEN 'STRING NULL'
        WHEN fica_documents = '{}' THEN 'EMPTY OBJECT'
        ELSE 'HAS DATA'
    END as fica_status,
    fica_documents->>'id_number' as extracted_id_number
FROM profiles 
ORDER BY created_at DESC;

-- Test 4: Try different query approaches
-- Approach A: Direct equality
SELECT COUNT(*) as count_direct FROM profiles WHERE fica_documents->>'id_number' = '7405105163087';

-- Approach B: Using LIKE
SELECT COUNT(*) as count_like FROM profiles WHERE fica_documents->>'id_number' LIKE '7405105163087';

-- Approach C: Using JSONB contains
SELECT COUNT(*) as count_contains FROM profiles WHERE fica_documents @> '{"id_number": "7405105163087"}';

-- Approach D: Using JSONB path
SELECT COUNT(*) as count_path FROM profiles WHERE fica_documents #>> '{id_number}' = '7405105163087'; 