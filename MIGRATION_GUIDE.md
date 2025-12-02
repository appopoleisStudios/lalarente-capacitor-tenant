# 🚀 Migration Guide: Enhanced Supabase Setup

## What Changed?

We've enhanced the Supabase configuration with better type safety, helper functions, and new storage buckets for the rental management features.

## ✅ Action Items

### 1. Update Your Imports (Optional but Recommended)

**Before:**
```typescript
import { Database } from '@/src/types/database.types';
type Property = Database['public']['Tables']['properties']['Row'];
```

**After:**
```typescript
import { Property, PropertyInsert, PropertyUpdate } from '@/src/lib/supabase';
```

### 2. Use New Helper Functions

**Authentication:**
```typescript
import { isAuthenticated, getCurrentUser, getCurrentUserProfile } from '@/src/lib/supabase';

// Check if user is logged in
const authenticated = await isAuthenticated();

// Get current user
const user = await getCurrentUser();

// Get user profile
const profile = await getCurrentUserProfile();
```

**File Upload:**
```typescript
import { uploadFile, getPublicUrl, deleteFile } from '@/src/lib/supabase';

// Upload
const data = await uploadFile('PROPERTY_IMAGES', 'path/to/file.jpg', fileBlob);

// Get URL
const url = getPublicUrl('PROPERTY_IMAGES', 'path/to/file.jpg');

// Delete
await deleteFile('PROPERTY_IMAGES', 'path/to/file.jpg');
```

### 3. Set Up Storage Buckets in Supabase

Run the SQL script in your Supabase dashboard:

1. Open Supabase Dashboard → SQL Editor
2. Copy contents from `supabase/storage-buckets-setup.sql`
3. Run the script
4. Verify with the verification query at the bottom

## 📦 New Storage Buckets

| Bucket | Public | Use Case |
|--------|--------|----------|
| `inspection-photos` | ✅ | Property inspection photos |
| `message-attachments` | ✅ | Message attachments |
| `id-documents` | ❌ | User ID documents |
| `proof-of-income` | ❌ | Income verification |
| `signatures` | ❌ | Digital signatures |
| `profiles` | ✅ | Profile pictures |

## 🔧 Breaking Changes

### None! 

All existing code will continue to work. The new features are additive and backward compatible.

## 📝 Type Aliases Available

```typescript
// Tables
Property, PropertyInsert, PropertyUpdate
Lease, LeaseInsert, LeaseUpdate
Payment, PaymentInsert
RentalApplication, RentalApplicationInsert
Inspection, InspectionInsert
Message, MessageThread
Document, DocumentInsert

// Enums
PropertyStatus
UserRole

// Generic helpers
Tables<'table_name'>
InsertTables<'table_name'>
UpdateTables<'table_name'>
Enums<'enum_name'>
```

## 🎯 Benefits

1. **Type Safety**: All storage bucket names are type-checked
2. **Cleaner Code**: Shorter imports and type definitions
3. **Helper Functions**: Common operations are now one-liners
4. **Better DX**: Autocomplete for bucket names and types
5. **Validation**: Environment variables are validated on startup

## 🐛 Troubleshooting

### "Missing Supabase environment variables" error

Make sure your `.env` file has:
```
EXPO_PUBLIC_SUPABASE_URL=your_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key_here
```

### Storage bucket not found

Run the `storage-buckets-setup.sql` script in your Supabase dashboard.

### Type errors after update

Regenerate your database types:
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
```

## 📚 Documentation

- See `supabase/README.md` for detailed setup instructions
- See `src/lib/supabase.ts` for all available helpers
- See `src/features/properties/api/propertiesApi.ts` for usage examples

## 🤝 Questions?

Check the inline comments in `src/lib/supabase.ts` or ask the team!
