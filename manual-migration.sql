-- Manual Migration Script for Supabase Dashboard
-- Run this in the Supabase SQL Editor
-- This script updates the FICA documents schema for secure document handling

-- Step 1: Create a backup of the current profiles table
CREATE TABLE IF NOT EXISTS profiles_backup AS 
SELECT * FROM profiles;

-- Step 2: Add temporary column for migration
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS fica_documents_new JSONB;

-- Step 3: Convert existing document_url to document_path
UPDATE profiles 
SET fica_documents_new = jsonb_set(
  COALESCE(fica_documents, '{}'::jsonb),
  '{document_path}',
  COALESCE(fica_documents->>'document_url', 'null'::jsonb)
)
WHERE fica_documents IS NOT NULL 
  AND fica_documents ? 'document_url';

-- Step 4: Remove the old document_url field
UPDATE profiles 
SET fica_documents_new = fica_documents_new - 'document_url'
WHERE fica_documents_new IS NOT NULL;

-- Step 5: Replace the old fica_documents column
UPDATE profiles 
SET fica_documents = fica_documents_new
WHERE fica_documents_new IS NOT NULL;

-- Step 6: Drop the temporary column
ALTER TABLE profiles 
DROP COLUMN IF EXISTS fica_documents_new;

-- Step 7: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_fica_documents_path 
ON profiles USING GIN ((fica_documents->>'document_path'));

-- Step 8: Add documentation comment
COMMENT ON COLUMN profiles.fica_documents IS 'FICA documents with secure document_path instead of public document_url';

-- Step 9: Create validation function
CREATE OR REPLACE FUNCTION validate_document_path(document_path TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN document_path IS NOT NULL 
    AND document_path ~ '^[a-zA-Z0-9_-]+-documents/[a-f0-9-]+/[a-zA-Z0-9._-]+$';
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create validation trigger
CREATE OR REPLACE FUNCTION validate_fica_document_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fica_documents IS NOT NULL 
    AND NEW.fica_documents ? 'document_path' 
    AND NOT validate_document_path(NEW.fica_documents->>'document_path') THEN
    RAISE EXCEPTION 'Invalid document_path format in fica_documents';
  END IF;
  
  IF NEW.fica_documents IS NOT NULL 
    AND NEW.fica_documents ? 'document_url' THEN
    RAISE EXCEPTION 'document_url is not allowed in fica_documents for security reasons';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_validate_fica_document_path ON profiles;
CREATE TRIGGER trigger_validate_fica_document_path
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_fica_document_path();

-- Step 11: Log the migration
INSERT INTO public.profiles (id, full_name, role, created_at, updated_at)
VALUES (
  'migration-manual',
  'Manual Migration: FICA Documents Security Update',
  'admin',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Step 12: Show migration results
SELECT 
  'Migration completed successfully!' as status,
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN fica_documents ? 'document_path' THEN 1 END) as profiles_with_document_path,
  COUNT(CASE WHEN fica_documents ? 'document_url' THEN 1 END) as profiles_with_document_url
FROM profiles; 