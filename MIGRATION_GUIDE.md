# Database Migration Guide: Update FICA Documents Schema

## Overview

This guide will help you update your database schema to use `document_path` instead of `document_url` for secure document handling. This migration is essential for implementing the secure document system that protects sensitive FICA documents.

## What This Migration Does

### ✅ **Security Improvements**
- Changes `document_url` to `document_path` in the database
- Removes public URL exposure of sensitive documents
- Implements secure access controls
- Adds validation triggers for document paths

### 🔄 **Data Migration**
- Converts existing `document_url` values to `document_path`
- Creates backup of current data
- Maintains data integrity during migration
- Provides rollback capability if needed

## Prerequisites

### 1. **Backup Your Database**
Before running any migration, ensure you have a complete backup of your Supabase database:

```bash
# In Supabase Dashboard:
# 1. Go to Settings > Database
# 2. Click "Create backup"
# 3. Download the backup file
```

### 2. **Install Dependencies**
Make sure you have the required dependencies:

```bash
npm install tsx --save-dev
```

### 3. **Verify Supabase Connection**
Ensure your Supabase connection is working:

```bash
# Test connection by running a simple query
npm run dev
# Check if the app connects to Supabase successfully
```

## Running the Migration

### **Option 1: Using npm script (Recommended)**

```bash
# Navigate to your project directory
cd lalarente-app

# Run the migration
npm run migrate
```

### **Option 2: Direct execution**

```bash
# Navigate to your project directory
cd lalarente-app

# Run the migration script directly
npx tsx scripts/runMigration.ts
```

## Migration Process

The migration will:

1. **Create a backup** of the current profiles table
2. **Convert existing data** from `document_url` to `document_path`
3. **Add security features**:
   - Validation triggers
   - Performance indexes
   - Access control functions
4. **Log the migration** for audit purposes

## Expected Output

```
🚀 Starting Database Migration...
📋 Migration: Update FICA Documents Schema
🔒 Purpose: Change document_url to document_path for security

📊 Checking migration status...
🔄 Executing migration...
✅ Migration completed successfully!
   Message: Migration 001_update_fica_documents_schema executed successfully
   Affected rows: 5

📊 Final migration status:
   Status: ✅ Executed
   Executed at: 2024-12-19T10:30:00.000Z

🎉 Migration process completed!

📝 Next steps:
   1. Test the application to ensure documents load correctly
   2. Verify that new registrations use document_path
   3. Update any UI components to use SecureDocumentViewer
   4. Consider removing old public URLs from storage
```

## Verification Steps

### 1. **Check Migration Status**

```bash
# Check if migration was successful
npm run migrate:status
```

### 2. **Verify Database Changes**

In your Supabase Dashboard:

1. Go to **Table Editor**
2. Select the **profiles** table
3. Check that `fica_documents` column contains `document_path` instead of `document_url`
4. Verify that the validation trigger was created

### 3. **Test Application**

1. **Test new registrations**:
   - Register a new tenant or owner
   - Verify documents are uploaded securely
   - Check that `document_path` is stored in database

2. **Test existing documents**:
   - Login with existing users
   - Verify documents still load correctly
   - Check that `SecureDocumentViewer` works

### 4. **Check Security**

1. **Verify signed URLs**:
   - Documents should use signed URLs with expiry
   - Public URLs should no longer be accessible
   - Access should require authentication

## Troubleshooting

### **Migration Fails**

If the migration fails, check:

1. **Database permissions**:
   ```sql
   -- Ensure your user has necessary permissions
   GRANT ALL PRIVILEGES ON TABLE profiles TO your_user;
   ```

2. **Supabase RPC function**:
   ```sql
   -- Check if exec_sql function exists
   SELECT * FROM pg_proc WHERE proname = 'exec_sql';
   ```

3. **Connection issues**:
   - Verify Supabase URL and API key
   - Check network connectivity
   - Ensure database is accessible

### **Rollback (If Needed)**

⚠️ **Warning**: Rolling back will re-expose documents to public access!

```bash
# Only use if absolutely necessary
npm run migrate:rollback
```

### **Manual Rollback**

If the automated rollback fails:

1. **Restore from backup**:
   ```sql
   -- Restore the profiles table from backup
   DROP TABLE profiles;
   CREATE TABLE profiles AS SELECT * FROM profiles_backup;
   ```

2. **Recreate indexes and triggers**:
   ```sql
   -- Recreate any missing indexes
   CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
   ```

## Post-Migration Tasks

### 1. **Update UI Components**

Replace any components that directly use `document_url` with `SecureDocumentViewer`:

```tsx
// Before (Insecure)
<img src={profile.fica_documents.document_url} />

// After (Secure)
<SecureDocumentViewer
  filePath={profile.fica_documents.document_path}
  fileName="FICA Document"
/>
```

### 2. **Clean Up Old URLs**

After confirming everything works:

1. **Remove old public URLs** from Supabase storage
2. **Update any hardcoded references** to old URL patterns
3. **Test thoroughly** to ensure no broken links

### 3. **Monitor Application**

1. **Check error logs** for any document access issues
2. **Monitor signed URL generation** performance
3. **Verify access controls** are working correctly

## Security Checklist

After migration, verify:

- ✅ No public URLs are stored in database
- ✅ All document access requires authentication
- ✅ Signed URLs expire after 1 hour
- ✅ Access controls are enforced
- ✅ Validation triggers prevent insecure data
- ✅ Error messages don't expose internal paths
- ✅ SQL validation prevents dangerous operations
- ✅ Audit logging captures all migration activities
- ✅ User authentication required for migrations
- ✅ Migration files are properly secured

## Security Considerations

⚠️ **Important**: The migration system uses the `exec_sql` RPC function which poses significant security risks if not properly secured.

**Security measures implemented:**
- SQL validation prevents dangerous operations
- Authentication required for all migrations
- Audit logging tracks all activities
- Pattern matching blocks malicious SQL
- User identification for accountability

**For detailed security information, see:**
- `SECURITY_MIGRATION_GUIDE.md` - Comprehensive security documentation
- `src/lib/migrations/migrationRunner.ts` - Security implementation

## Support

If you encounter issues:

1. **Check the logs** in your Supabase dashboard
2. **Review the migration status** using `npm run migrate:status`
3. **Verify your Supabase configuration** in `src/lib/supabase.ts`
4. **Test with a fresh database** to isolate issues

## Migration Files

The migration consists of these files:

- `src/lib/migrations/001_update_fica_documents_schema.sql` - Main migration
- `src/lib/migrations/001_update_fica_documents_schema_rollback.sql` - Rollback script
- `src/lib/migrations/migrationRunner.ts` - Migration runner utility
- `scripts/runMigration.ts` - Migration execution script

## Next Steps

After successful migration:

1. **Deploy the updated application** with secure document handling
2. **Train users** on the new secure document system
3. **Monitor for any issues** in production
4. **Consider implementing additional security measures** like audit logging 