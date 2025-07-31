-- Role-based ID number checking functions
-- This allows the same SA ID to be used across different roles (tenant/owner/vendor)
-- but prevents duplicates within the same role

-- Function to check if an ID number exists for a specific role
CREATE OR REPLACE FUNCTION check_id_exists_for_role(id_num TEXT, user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM profiles
        WHERE fica_documents IS NOT NULL
            AND fica_documents != 'null'::jsonb
            AND fica_documents != '{}'::jsonb
            AND fica_documents->>'id_number' IS NOT NULL
            AND TRIM(fica_documents->>'id_number') != ''
            AND TRIM(fica_documents->>'id_number') = TRIM(id_num)
            AND role::TEXT = user_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all profiles with a specific ID number and role
CREATE OR REPLACE FUNCTION get_profiles_by_id_and_role(id_num TEXT, user_role TEXT)
RETURNS TABLE(
    id UUID,
    full_name TEXT,
    email TEXT,
    role TEXT,
    id_number TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        p.email,
        p.role,
        p.fica_documents->>'id_number' as id_number,
        p.created_at
    FROM profiles p
    WHERE p.fica_documents IS NOT NULL
        AND p.fica_documents != 'null'::jsonb
        AND p.fica_documents != '{}'::jsonb
        AND p.fica_documents->>'id_number' IS NOT NULL
        AND TRIM(p.fica_documents->>'id_number') != ''
        AND TRIM(p.fica_documents->>'id_number') = TRIM(id_num)
        AND p.role::TEXT = user_role
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test the functions
-- SELECT check_id_exists_for_role('7405105163087', 'tenant');
-- SELECT check_id_exists_for_role('7405105163087', 'owner');
-- SELECT * FROM get_profiles_by_id_and_role('7405105163087', 'tenant'); 