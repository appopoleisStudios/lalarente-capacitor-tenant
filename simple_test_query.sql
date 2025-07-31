-- Simple test to verify the exact query that should work
-- This should return 2 profiles with ID 7405105163087

SELECT 
    id,
    full_name,
    email,
    role,
    fica_documents->>'id_number' as id_number,
    created_at
FROM profiles 
WHERE fica_documents IS NOT NULL
    AND fica_documents != 'null'
    AND fica_documents != '{}'
    AND fica_documents->>'id_number' IS NOT NULL
    AND fica_documents->>'id_number' != ''
    AND fica_documents->>'id_number' = '7405105163087'
ORDER BY created_at DESC; 