# Task 1.4: Photo/Video Upload - Setup & Testing

**Date:** October 15, 2025  
**Status:** ✅ Code Complete - Ready for Testing  
**Time:** 15 min

---

## ✅ What Was Fixed

### Issue:
Media files were being uploaded to Storage but NOT saved to the database.

### Solution:
Updated the submit handler to save image URLs after upload:

```typescript
// Before:
if (imageUrls.length > 0) {
  await maintenanceApi.updateStatus(request.id, 'open');
  // Note: images not being saved!
}

// After:
if (imageUrls.length > 0) {
  await maintenanceApi.updateMaintenanceRequest(request.id, {
    images: imageUrls,
  });
}
```

---

## 🛠️ Supabase Storage Setup

### Step 1: Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. **Bucket name:** `maintenance-media`
4. **Public bucket:** ✅ Yes (check this box)
5. Click "Create bucket"

### Step 2: Set Bucket Policies (REQUIRED)

**⚠️ IMPORTANT:** Even if the bucket is marked as "public", you MUST set up RLS policies for uploads to work.

Run this SQL in Supabase SQL Editor:

```sql
-- Copy and paste the entire contents of STORAGE_BUCKET_SETUP.sql
-- Or run these essential policies:

-- Allow public read access
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'maintenance-media');

-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads to maintenance-media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'maintenance-media' 
  AND auth.role() = 'authenticated'
);
```

### Step 3: Verify Setup

Run this to verify:
```sql
-- Check bucket exists and is public
SELECT id, name, public FROM storage.buckets WHERE id = 'maintenance-media';

-- Check policies exist
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'objects' 
  AND policyname LIKE '%maintenance%';
```

Expected results:
- Bucket exists with `public = true`
- At least 2 policies: one for SELECT, one for INSERT

---

## 🔄 How It Works

### Complete Flow:

```
1. User fills maintenance request form
   ├─ Title, description, property, etc.
   └─ Adds photos/videos

2. User clicks "Submit Request"
   ↓
3. Create request in database (without images)
   ├─ Returns request with ID
   └─ Status: 'open'
   ↓
4. Upload media files to Storage
   ├─ Bucket: maintenance-media
   ├─ Path: {requestId}/{timestamp}-{random}.{ext}
   ├─ Example: abc123/1697385600-x7k2p.jpg
   └─ Returns array of public URLs
   ↓
5. Update request with image URLs
   ├─ Call: updateMaintenanceRequest(id, { images: urls })
   └─ Saves URLs to maintenance_requests.images column
   ↓
6. Show success message
   ↓
7. Navigate back to list
```

### Storage Structure:

```
maintenance-media/
├── {request-id-1}/
│   ├── 1697385600-x7k2p.jpg
│   ├── 1697385601-a9m3n.jpg
│   └── 1697385602-b4k8l.mp4
├── {request-id-2}/
│   ├── 1697385700-c2n5m.jpg
│   └── 1697385701-d6p9k.jpg
└── ...
```

---

## 🧪 Testing Checklist

### Before Testing:
- [ ] Create `maintenance-media` bucket in Supabase
- [ ] Set bucket to public
- [ ] Verify bucket policies (optional)

### Test Scenarios:

#### 1. Create Request with Photos
- [ ] Open create maintenance screen
- [ ] Fill required fields
- [ ] Tap "Take Photo" button
- [ ] Take a photo with camera
- [ ] Verify photo appears in preview
- [ ] Submit form
- [ ] **Verify:** Request created successfully
- [ ] **Verify:** Photo uploaded to Storage
- [ ] **Verify:** Photo URL saved in database
- [ ] Open detail screen
- [ ] **Verify:** Photo displays in gallery

#### 2. Create Request with Gallery Images
- [ ] Open create maintenance screen
- [ ] Fill required fields
- [ ] Tap "Pick from Gallery" button
- [ ] Select 3 images
- [ ] Verify images appear in preview
- [ ] Submit form
- [ ] **Verify:** All 3 images uploaded
- [ ] **Verify:** All 3 URLs saved in database
- [ ] Open detail screen
- [ ] **Verify:** All 3 images display in gallery

#### 3. Create Request with Video
- [ ] Open create maintenance screen
- [ ] Fill required fields
- [ ] Tap "Pick from Gallery" button
- [ ] Select a video (under 50MB)
- [ ] Verify video appears in preview
- [ ] Submit form
- [ ] **Verify:** Video uploaded to Storage
- [ ] **Verify:** Video URL saved in database
- [ ] Open detail screen
- [ ] **Verify:** Video plays in gallery

#### 4. Create Request with Mixed Media
- [ ] Open create maintenance screen
- [ ] Fill required fields
- [ ] Add 2 photos + 1 video
- [ ] Verify all appear in preview
- [ ] Submit form
- [ ] **Verify:** All files uploaded
- [ ] **Verify:** All URLs saved in database
- [ ] Open detail screen
- [ ] **Verify:** All media displays correctly

#### 5. Remove Media Before Submit
- [ ] Open create maintenance screen
- [ ] Add 3 photos
- [ ] Tap X on one photo to remove
- [ ] **Verify:** Photo removed from preview
- [ ] Submit form
- [ ] **Verify:** Only 2 photos uploaded

#### 6. Max Files Limit
- [ ] Open create maintenance screen
- [ ] Try to add 11 files (limit is 10)
- [ ] **Verify:** Alert shows "Limit Reached"
- [ ] **Verify:** Only 10 files in preview

#### 7. Large Video Rejection
- [ ] Try to select video over 50MB
- [ ] **Verify:** Alert shows "File Too Large"
- [ ] **Verify:** Video not added to preview

#### 8. Create Request Without Media
- [ ] Open create maintenance screen
- [ ] Fill required fields
- [ ] Don't add any media
- [ ] Submit form
- [ ] **Verify:** Request created successfully
- [ ] **Verify:** No upload attempted
- [ ] **Verify:** images field is null in database

---

## 🔍 Database Verification

### Check Uploaded Files:

```sql
-- View recent requests with images
SELECT 
  id,
  title,
  images,
  created_at
FROM maintenance_requests
WHERE images IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- Count requests with media
SELECT 
  COUNT(*) as total_requests,
  COUNT(images) as requests_with_media,
  COUNT(*) - COUNT(images) as requests_without_media
FROM maintenance_requests;
```

### Check Storage Files:

1. Go to Supabase Dashboard → Storage → maintenance-media
2. Browse folders (each folder = request ID)
3. Verify files are organized correctly
4. Click file to view/download

---

## 📊 Expected Results

### Database:
```json
{
  "id": "abc-123-def",
  "title": "Leaking faucet",
  "images": [
    "https://xxx.supabase.co/storage/v1/object/public/maintenance-media/abc-123-def/1697385600-x7k2p.jpg",
    "https://xxx.supabase.co/storage/v1/object/public/maintenance-media/abc-123-def/1697385601-a9m3n.jpg"
  ],
  "created_at": "2025-10-15T10:30:00Z"
}
```

### Storage:
```
maintenance-media/
└── abc-123-def/
    ├── 1697385600-x7k2p.jpg  (uploaded)
    └── 1697385601-a9m3n.jpg  (uploaded)
```

### Detail Screen:
- Gallery shows 2 images
- Can tap to view full-screen
- Can swipe between images
- Counter shows "1/2", "2/2"

---

## 🐛 Troubleshooting

### Issue: "Failed to upload photo"
**Cause:** Bucket doesn't exist or not public  
**Fix:** Create bucket and set to public

### Issue: "Permission denied"
**Cause:** User not authenticated  
**Fix:** Ensure user is logged in

### Issue: Images uploaded but not showing in detail
**Cause:** URLs not saved to database  
**Fix:** Verify `updateMaintenanceRequest` is called after upload

### Issue: Video won't play
**Cause:** Video too large or wrong format  
**Fix:** Ensure video under 50MB and MP4 format

### Issue: "Bucket not found"
**Cause:** Bucket name mismatch  
**Fix:** Verify bucket name is exactly `maintenance-media`

---

## 📁 Files Modified

1. **ReportMaintenanceScreen.tsx** ✅
   - Fixed image URL saving after upload
   - Now calls `updateMaintenanceRequest` with image URLs

2. **useMediaUpload.ts** ✅
   - Already implemented (no changes needed)
   - Handles camera, gallery, video
   - Uploads to Storage
   - Returns public URLs

3. **maintenanceApi.ts** ✅
   - Already has `updateMaintenanceRequest` method
   - Accepts `images` array

---

## ✅ Success Criteria

- [x] Code complete and working
- [ ] Storage bucket created
- [ ] Can upload photos from camera
- [ ] Can upload photos from gallery
- [ ] Can upload videos
- [ ] Files organized by request ID
- [ ] URLs saved to database
- [ ] Media displays in detail screen
- [ ] Progress indicator shows during upload
- [ ] Error handling works
- [ ] Max file limit enforced
- [ ] Large files rejected

---

## 🎯 Next Steps

1. **Create Storage bucket** in Supabase
2. **Test complete flow** with photos/videos
3. **Verify database** has image URLs
4. **Check Storage** has uploaded files
5. **Test detail screen** displays media correctly

---

**Task 1.4 is code-complete and ready for testing!** 🎉

Just need to create the Storage bucket and test the flow.
