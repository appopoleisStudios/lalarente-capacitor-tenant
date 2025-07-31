-- Cleanup Duplicate ID Numbers and Add Constraints
-- This script will:
-- 1. Identify duplicate ID numbers
-- 2. Keep only the first user with each ID number
-- 3. Add database constraints to prevent future duplicates

-- Step 1: Show current duplicates
SELECT 
    fica_documents->>'id_number' as id_number,
    COUNT(*) as duplicate_count,
    STRING_AGG(full_name || ' (' || id || ')', ', ') as users
FROM profiles 
WHERE fica_documents->>'id_number' IS NOT NULL
    AND fica_documents IS NOT NULL
GROUP BY fica_documents->>'id_number'
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 2: Create a temporary table to identify which records to keep
CREATE TEMP TABLE keep_records AS
SELECT DISTINCT ON (fica_documents->>'id_number') 
    id,
    fica_documents->>'id_number' as id_number
FROM profiles 
WHERE fica_documents->>'id_number' IS NOT NULL
    AND fica_documents IS NOT NULL
ORDER BY fica_documents->>'id_number', created_at ASC;

-- Step 3: Show which records will be kept
SELECT 
    kr.id_number,
    p.full_name,
    p.email,
    p.created_at
FROM keep_records kr
JOIN profiles p ON kr.id = p.id
ORDER BY kr.id_number;

-- Step 4: Delete duplicate records (keep only the first one for each ID number)
DELETE FROM profiles 
WHERE id NOT IN (SELECT id FROM keep_records)
    AND fica_documents->>'id_number' IS NOT NULL
    AND fica_documents IS NOT NULL;

-- Step 5: Add email column if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Step 6: Create unique index for email addresses
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique 
ON profiles (email) 
WHERE email IS NOT NULL;

-- Step 7: Create a function to check for duplicate ID numbers
CREATE OR REPLACE FUNCTION check_duplicate_id_number(new_id_number TEXT, exclude_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE fica_documents->>'id_number' = new_id_number
    AND (exclude_user_id IS NULL OR id != exclude_user_id)
    AND fica_documents IS NOT NULL
    AND LENGTH(TRIM(fica_documents->>'id_number')) > 0
  );
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create a function to prevent duplicate ID numbers
CREATE OR REPLACE FUNCTION prevent_duplicate_id_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fica_documents IS NOT NULL 
    AND NEW.fica_documents->>'id_number' IS NOT NULL
    AND LENGTH(TRIM(NEW.fica_documents->>'id_number')) > 0
    AND check_duplicate_id_number(NEW.fica_documents->>'id_number', NEW.id) THEN
    RAISE EXCEPTION 'ID number % is already registered by another user', NEW.fica_documents->>'id_number';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create trigger to prevent duplicate ID numbers
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_id_number ON profiles;
CREATE TRIGGER trigger_prevent_duplicate_id_number
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_id_number();

-- Step 10: Create email validation function
CREATE OR REPLACE FUNCTION validate_email_format()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format: %', NEW.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Create trigger for email validation
DROP TRIGGER IF EXISTS trigger_validate_email_format ON profiles;
CREATE TRIGGER trigger_validate_email_format
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_email_format();

-- Step 12: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_fica_documents_id_number 
ON profiles ((fica_documents->>'id_number'));

CREATE INDEX IF NOT EXISTS idx_profiles_fica_documents_gin 
ON profiles USING GIN (fica_documents);

-- Step 13: Verify cleanup
SELECT 
    fica_documents->>'id_number' as id_number,
    COUNT(*) as user_count
FROM profiles 
WHERE fica_documents->>'id_number' IS NOT NULL
    AND fica_documents IS NOT NULL
GROUP BY fica_documents->>'id_number'
HAVING COUNT(*) > 1
ORDER BY user_count DESC;

-- This should return no rows if cleanup was successful 