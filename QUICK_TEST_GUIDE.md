# 🚀 Quick Test Guide - Create Maintenance Request with Media

**Goal:** Test complete flow from creating request to viewing it with photos/videos

---

## ⚡ Quick Setup (5 min)

### 1. Create Storage Bucket
```
1. Open Supabase Dashboard
2. Go to Storage
3. Click "New bucket"
4. Name: maintenance-media
5. Check "Public bucket"
6. Click "Create"
```

### 2. Set Up Storage Policies (REQUIRED!)
```
1. Go to Supabase Dashboard → SQL Editor
2. Open STORAGE_BUCKET_SETUP.sql
3. Copy and paste the SQL
4. Click "Run"
5. Verify: Should see "Success" messages
```

**⚠️ Without these policies, uploads will fail with "row-level security policy" error!**

### 3. Verify Database
```sql
-- Check if you have test data
SELECT * FROM service_categories LIMIT 5;
SELECT * FROM properties WHERE owner_id = 'YOUR_OWNER_ID' LIMIT 5;
```

---

## 🧪 Test Flow (5 min)

### Step 1: Login
```
1. Open app
2. Login as owner
3. Navigate to Maintenance tab
```

### Step 2: Create Request
```
1. Tap + button
2. Fill form:
   - Title: "Leaking faucet in kitchen"
   - Description: "Water dripping from main faucet"
   - Property: Select any property
   - Priority: High
   - Category: Plumbing
   - Visibility: Open Market
3. Add media:
   - ⚠️ On Simulator: Use "Pick from Gallery" (camera not available)
   - On Device: Can use "Take Photo" or "Pick from Gallery"
   - Select 2-3 photos
4. Tap "Submit Request"
5. Wait for success message
6. Tap "OK"
```

### Step 3: Verify in List
```
1. Should return to maintenance list
2. New request should appear at top
3. Thumbnail should show first photo
```

### Step 4: View Details
```
1. Tap on the new request card
2. Verify:
   - All details shown correctly
   - Photos display in gallery
   - Can tap photo to view full-screen
   - Can swipe between photos
   - Counter shows "1/3", "2/3", etc.
```

### Step 5: Verify Database
```sql
-- Check the request
SELECT 
  id,
  title,
  category_id,
  visibility,
  images,
  created_at
FROM maintenance_requests
ORDER BY created_at DESC
LIMIT 1;

-- Should see:
-- - category_id: UUID of Plumbing
-- - visibility: 'public'
-- - images: Array of URLs
```

### Step 6: Verify Storage
```
1. Go to Supabase Dashboard → Storage → maintenance-media
2. Find folder with request ID
3. Verify photos are there
4. Click to view/download
```

---

## ✅ Success Checklist

- [ ] Request created successfully
- [ ] Category saved (Plumbing)
- [ ] Visibility saved (public)
- [ ] Photos uploaded to Storage
- [ ] Photo URLs saved in database
- [ ] Request appears in list
- [ ] Photos display in detail screen
- [ ] Full-screen viewer works
- [ ] Can swipe between photos

---

## 🐛 If Something Fails

### Photos not uploading - "row-level security policy" error:
```
1. ✅ Check bucket exists: maintenance-media
2. ✅ Check bucket is public
3. ⚠️ MOST COMMON: Run STORAGE_BUCKET_SETUP.sql to create RLS policies
4. ✅ Check user is authenticated (should be logged in)
5. ✅ Check console for errors

To fix:
- Go to Supabase SQL Editor
- Run the SQL from STORAGE_BUCKET_SETUP.sql
- Try upload again
```

### Photos uploaded but not showing:
```
1. Check database has image URLs
2. Run: SELECT images FROM maintenance_requests WHERE id = 'REQUEST_ID'
3. If NULL, check updateMaintenanceRequest is called
```

### Category not saved:
```
1. Check category was selected in form
2. Run: SELECT category_id FROM maintenance_requests WHERE id = 'REQUEST_ID'
3. Should be UUID, not NULL
```

### Visibility not saved:
```
1. Check visibility was selected (owner only)
2. Run: SELECT visibility FROM maintenance_requests WHERE id = 'REQUEST_ID'
3. Should be 'public' or 'invited'
```

---

## 📊 Expected Database Result

```json
{
  "id": "abc-123-def-456",
  "title": "Leaking faucet in kitchen",
  "description": "Water dripping from main faucet",
  "property_id": "prop-123",
  "owner_id": "owner-123",
  "tenant_id": null,
  "category_id": "92ce5667-41a5-4b68-90ed-cd25fc335760",
  "priority": "high",
  "status": "open",
  "visibility": "public",
  "images": [
    "https://xxx.supabase.co/storage/v1/object/public/maintenance-media/abc-123-def-456/1697385600-x7k2p.jpg",
    "https://xxx.supabase.co/storage/v1/object/public/maintenance-media/abc-123-def-456/1697385601-a9m3n.jpg"
  ],
  "created_at": "2025-10-15T10:30:00Z"
}
```

---

## 🎯 What's Next

After successful test:
1. ✅ Phase 1 is 100% complete
2. 📝 Ready for Phase 2: Vendor Selection
3. 🚀 Can start building VendorSelectionScreen

---

**Total Test Time:** ~10 minutes  
**If all passes:** Phase 1 COMPLETE! 🎉
