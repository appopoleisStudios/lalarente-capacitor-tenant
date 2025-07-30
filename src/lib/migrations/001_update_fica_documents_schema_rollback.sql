-- Rollback Migration: Revert FICA Documents Schema Changes
-- Description: Revert document_path back to document_url (NOT RECOMMENDED for security reasons)
-- Date: 2024-12-19
-- Author: System Migration
-- WARNING: This rollback will re-expose documents to public access

-- Step 1: Create a backup of the current state
CREATE TABLE IF NOT EXISTS profiles_backup_rollback AS 
SELECT * FROM profiles;

-- Step 2: Add temporary column for rollback
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS fica_documents_rollback JSONB;

-- Step 3: Convert document_path back to document_url (SECURITY RISK)
UPDATE profiles 
SET fica_documents_rollback = jsonb_set(
  COALESCE(fica_documents, '{}'::jsonb),
  '{document_url}',
  COALESCE(fica_documents->>'document_path', 'null'::jsonb)
)
WHERE fica_documents IS NOT NULL 
  AND fica_documents ? 'document_path';

-- Step 4: Remove the document_path field
UPDATE profiles 
SET fica_documents_rollback = fica_documents_rollback - 'document_path'
WHERE fica_documents_rollback IS NOT NULL;

-- Step 5: Replace the fica_documents column with rollback version
UPDATE profiles 
SET fica_documents = fica_documents_rollback
WHERE fica_documents_rollback IS NOT NULL;

-- Step 6: Drop the temporary column
ALTER TABLE profiles 
DROP COLUMN IF EXISTS fica_documents_rollback;

-- Step 7: Drop the security index
DROP INDEX IF EXISTS idx_profiles_fica_documents_path;

-- Step 8: Drop the validation trigger and function
DROP TRIGGER IF EXISTS trigger_validate_fica_document_path ON profiles;
DROP FUNCTION IF EXISTS validate_fica_document_path();
DROP FUNCTION IF EXISTS validate_document_path(TEXT);

-- Step 9: Update the column comment
COMMENT ON COLUMN profiles.fica_documents IS 'FICA documents (ROLLED BACK - using document_url again)';

-- Step 10: Log the rollback
INSERT INTO public.profiles (id, full_name, role, created_at, updated_at)
VALUES (
  'migration-rollback',
  'Schema Rollback: FICA Documents Security Reverted',
  'admin',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING; 