-- Improved ID Number Check Function
-- This function provides a more robust way to check for duplicate ID numbers
-- It handles edge cases and uses the correct JSONB operators

-- Simple function to check if an ID number exists
CREATE OR REPLACE FUNCTION check_id_exists(id_num TEXT)
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
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if an ID number already exists (normalized)
CREATE OR REPLACE FUNCTION check_id_number_exists_normalized(id_num TEXT)
RETURNS TABLE(
    id_exists BOOLEAN,
    profile_count INTEGER,
    profile_details JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) > 0 as id_exists,
        COUNT(*)::INTEGER as profile_count,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', p.id,
                    'full_name', p.full_name,
                    'email', p.email,
                    'role', p.role,
                    'created_at', p.created_at
                )
            ),
            '[]'::jsonb
        ) as profile_details
    FROM profiles p
    WHERE p.fica_documents IS NOT NULL
        AND p.fica_documents != 'null'
        AND p.fica_documents != '{}'
        AND TRIM(p.fica_documents->>'id_number') = TRIM(id_num)
        AND p.fica_documents->>'id_number' IS NOT NULL
        AND p.fica_documents->>'id_number' != '';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all profiles with a specific ID number
CREATE OR REPLACE FUNCTION get_profiles_by_id_number(id_num TEXT)
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
        AND p.fica_documents != 'null'
        AND p.fica_documents != '{}'
        AND TRIM(p.fica_documents->>'id_number') = TRIM(id_num)
        AND p.fica_documents->>'id_number' IS NOT NULL
        AND p.fica_documents->>'id_number' != ''
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test the functions
-- SELECT * FROM check_id_number_exists_normalized('7405105163087');
-- SELECT * FROM get_profiles_by_id_number('7405105163087'); 