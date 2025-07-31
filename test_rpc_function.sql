-- Test the RPC function
-- First, let's make sure the function exists
SELECT 
    routine_name, 
    routine_type 
FROM information_schema.routines 
WHERE routine_name = 'check_id_number_exists_normalized';

-- Test the function directly
SELECT * FROM check_id_number_exists_normalized('7405105163087');

-- Test with a non-existent ID
SELECT * FROM check_id_number_exists_normalized('9999999999999'); 