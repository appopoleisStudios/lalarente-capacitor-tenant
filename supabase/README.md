# Supabase Setup Guide

This directory contains SQL scripts and configuration for setting up your Supabase backend.

## 📁 Files

- `storage-buckets-setup.sql` - Creates all required storage buckets and RLS policies

## 🚀 Quick Start

### 1. Create Storage Buckets

Run the `storage-buckets-setup.sql` file in your Supabase SQL Editor:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `storage-buckets-setup.sql`
5. Click **Run**

This will create the following buckets:

| Bucket Name | Public | Max Size | Allowed Types | Purpose |
|------------|--------|----------|---------------|---------|
| `inspection-photos` | ✅ Yes | 50 MB | JPEG, PNG, WebP | Property inspection photos |
| `message-attachments` | ✅ Yes | 10 MB | JPEG, PNG, WebP, PDF | Message attachments |
| `id-documents` | ❌ No | 5 MB | JPEG, PNG, PDF | User ID documents (private) |
| `proof-of-income` | ❌ No | 5 MB | JPEG, PNG, PDF | Income verification (private) |
| `signatures` | ❌ No | 1 MB | PNG, SVG | Digital signatures (private) |
| `profiles` | ✅ Yes | 2 MB | JPEG, PNG, WebP | User profile pictures |

### 2. Verify Setup

After running the SQL script, verify all buckets were created:

```sql
SELECT 
  id,
  name,
  public,
  created_at
FROM storage.buckets
WHERE id IN (
  'inspection-photos',
  'message-attachments',
  'id-documents',
  'proof-of-income',
  'signatures',
  'profiles'
)
ORDER BY name;
```

You should see 6 rows returned.

## 🔒 Security (RLS Policies)

The SQL script automatically sets up Row Level Security (RLS) policies for each bucket:

### Public Buckets (Read: Everyone, Write: Authenticated)
- `inspection-photos` - 50 MB max, images only
- `message-attachments` - 10 MB max, images + PDFs
- `profiles` - 2 MB max, images only

### Private Buckets (Read/Write: Owner + Admins)
- `id-documents` - 5 MB max, images + PDFs
- `proof-of-income` - 5 MB max, images + PDFs
- `signatures` - 1 MB max, PNG/SVG only

**Note:** Admins can view all private documents for verification purposes.

## 💻 Usage in Code

The enhanced `src/lib/supabase.ts` provides helper functions:

```typescript
import { 
  uploadFile, 
  getPublicUrl, 
  deleteFile,
  STORAGE_BUCKETS 
} from '@/src/lib/supabase';

// Upload a file
const data = await uploadFile(
  'INSPECTION_PHOTOS',
  'user-id/inspection-123.jpg',
  fileBlob,
  { contentType: 'image/jpeg' }
);

// Get public URL
const url = getPublicUrl('INSPECTION_PHOTOS', 'user-id/inspection-123.jpg');

// Delete a file
await deleteFile('INSPECTION_PHOTOS', 'user-id/inspection-123.jpg');
```

## 📝 Type Safety

All storage bucket names are type-safe:

```typescript
// ✅ This works
uploadFile('INSPECTION_PHOTOS', path, file);

// ❌ This will cause a TypeScript error
uploadFile('invalid-bucket', path, file);
```

## 🔄 Updating Database Types

When you make changes to your Supabase schema:

1. Generate new types:
   ```bash
   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
   ```

2. The `supabase.ts` file will automatically use the updated types

## 📚 Additional Resources

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage RLS Policies](https://supabase.com/docs/guides/storage/security/access-control)
