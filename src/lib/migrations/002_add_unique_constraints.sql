-- Migration: Add Unique Constraints for Email and ID Number
-- Description: Prevent duplicate email addresses and ID numbers in the system
-- Date: 2024-12-19
-- Author: System Migration

-- Step 1: Add unique constraint for email addresses
-- Note: This assumes we have an email column in profiles table
-- If not, we'll need to add it first

-- Add email column if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create unique index for email addresses
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique 
ON profiles (email) 
WHERE email IS NOT NULL;

-- Step 2: Create a function to check for duplicate ID numbers
CREATE OR REPLACE FUNCTION check_duplicate_id_number(new_id_number TEXT, exclude_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    existing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO existing_count
    FROM profiles
    WHERE fica_documents->>'id_number' = new_id_number
    AND (exclude_user_id IS NULL OR id != exclude_user_id);
    
    RETURN existing_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create a trigger function to prevent duplicate ID numbers
CREATE OR REPLACE FUNCTION prevent_duplicate_id_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the new record has an ID number
    IF NEW.fica_documents IS NOT NULL 
       AND NEW.fica_documents ? 'id_number' 
       AND NEW.fica_documents->>'id_number' IS NOT NULL THEN
        
        -- Check for duplicates
        IF check_duplicate_id_number(NEW.fica_documents->>'id_number', NEW.id) THEN
            RAISE EXCEPTION 'ID number % is already registered by another user', NEW.fica_documents->>'id_number';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to enforce ID number uniqueness
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_id_number ON profiles;
CREATE TRIGGER trigger_prevent_duplicate_id_number
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_duplicate_id_number();

-- Step 5: Create a function to validate email format
CREATE OR REPLACE FUNCTION validate_email_format(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create a trigger function to validate email format
CREATE OR REPLACE FUNCTION validate_email_format_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS NOT NULL AND NOT validate_email_format(NEW.email) THEN
        RAISE EXCEPTION 'Invalid email format: %', NEW.email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger to enforce email format validation
DROP TRIGGER IF EXISTS trigger_validate_email_format ON profiles;
CREATE TRIGGER trigger_validate_email_format
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION validate_email_format_trigger();

-- Step 8: Add comments for documentation
COMMENT ON FUNCTION check_duplicate_id_number(TEXT, UUID) IS 'Check if an ID number already exists in the system';
COMMENT ON FUNCTION prevent_duplicate_id_number() IS 'Trigger function to prevent duplicate ID numbers';
COMMENT ON FUNCTION validate_email_format(TEXT) IS 'Validate email format using regex';
COMMENT ON FUNCTION validate_email_format_trigger() IS 'Trigger function to validate email format';

-- Step 9: Create indexes for better performance
-- Use BTREE index for text field instead of GIN
CREATE INDEX IF NOT EXISTS idx_profiles_fica_documents_id_number 
ON profiles ((fica_documents->>'id_number'));

-- Create GIN index for the entire fica_documents JSONB field for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_fica_documents_gin 
ON profiles USING GIN (fica_documents);

-- Step 10: Add constraint to ensure ID numbers are not empty when present
ALTER TABLE profiles 
ADD CONSTRAINT check_id_number_not_empty 
CHECK (
    fica_documents IS NULL 
    OR fica_documents->>'id_number' IS NULL 
    OR LENGTH(TRIM(fica_documents->>'id_number')) > 0
); 