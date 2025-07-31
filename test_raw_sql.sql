-- Test the raw SQL approach that the app will use
-- This should return 4 for the existing ID number

SELECT COUNT(*) as count
FROM profiles 
WHERE fica_documents IS NOT NULL
  AND fica_documents != 'null'
  AND fica_documents != '{}'
  AND fica_documents->>'id_number' IS NOT NULL
  AND fica_documents->>'id_number' != ''
  AND fica_documents->>'id_number' = '7405105163087'; 