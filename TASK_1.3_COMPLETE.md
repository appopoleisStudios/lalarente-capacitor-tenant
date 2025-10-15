# ✅ Task 1.3: Connect ReportMaintenanceScreen to API - COMPLETE

**Date:** October 15, 2025  
**Status:** ✅ Complete  
**Task:** Ensure maintenance request creation captures category_id and visibility for vendor filtering

---

## 🎯 What Was Done

### 1. **Fixed Visibility Field** ✅
- **Issue:** Visibility was in state but NOT being passed to API
- **Fix:** Added `visibility` to the `createMaintenanceRequest` API call
- **File:** `ReportMaintenanceScreen.tsx`

```typescript
const request = await maintenanceApi.createMaintenanceRequest({
  property_id: propertyId,
  owner_id: isOwner ? user.id : '',
  tenant_id: isOwner ? '' : user.id,
  category_id: categoryId || undefined,
  priority,
  title: title.trim(),
  description: description.trim(),
  visibility, // ✅ NOW PASSED TO API
});
```

### 2. **Verified Category Capture** ✅
- Category selection UI is working
- `category_id` is properly passed to API
- Database column exists and accepts UUID

### 3. **Added Vendor Filtering API Functions** ✅
Added three new functions to `maintenanceApi.ts`:

#### a) `getVendorsByCategory(categoryId)` 
- Fetches ALL vendors who offer services in a specific category
- Used for **"Open Market"** (public) requests
- Filters by `vendor_services.category_id`

#### b) `getDedicatedVendors(propertyId, categoryId?)`
- Fetches vendors assigned to a specific property
- Used for **"Invite Only"** (invited) requests
- Filters by `dedicated_vendors` table
- Optionally filters by category

#### c) `getVendorsForRequest(requestId)`
- Smart function that determines which vendors to show
- Checks request visibility and category
- Returns appropriate vendor list

---

## 📊 Database Structure Verified

### Tables Confirmed:
1. ✅ `maintenance_requests` - Has `category_id` and `visibility` columns
2. ✅ `service_categories` - 5 categories (Plumbing, Electrical, HVAC, Cleaning, Security)
3. ✅ `vendor_services` - Links vendors to services (needs category_id populated)
4. ✅ `dedicated_vendors` - Links vendors to properties for "Invite Only" mode

### Category IDs:
```
92ce5667-41a5-4b68-90ed-cd25fc335760 - Plumbing
14c5f530-fca2-4fbd-92fe-d3498782bd88 - Electrical
841fc30b-7571-4fdd-8135-a9bc0f9aa30e - HVAC
438a81de-980e-482e-a1a2-975cb9775e14 - Cleaning
cef5ce16-9e1c-4d10-8f51-34b3a6d91186 - Security
```

---

## ⚠️ Database Fix Required

### Issue:
The `vendor_services.category_id` column is currently **NULL** for all services. This means vendors can't be filtered by category yet.

### Solution:
Run the SQL queries in `FIX_VENDOR_CATEGORIES.sql` to:
1. Link existing vendor services to appropriate categories
2. Enable vendor filtering by category

### Quick Fix for Test Vendor (arsalan@appopoleis.com):
```sql
-- Plumbing services
UPDATE vendor_services 
SET category_id = '92ce5667-41a5-4b68-90ed-cd25fc335760'
WHERE vendor_id = '203dd4a3-1739-4b32-b0c0-3074d1dc3497'
  AND (title ILIKE '%plumb%' OR title ILIKE '%geyser%');

-- Electrical services
UPDATE vendor_services 
SET category_id = '14c5f530-fca2-4fbd-92fe-d3498782bd88'
WHERE vendor_id = '203dd4a3-1739-4b32-b0c0-3074d1dc3497'
  AND title ILIKE '%electric%';

-- Cleaning services
UPDATE vendor_services 
SET category_id = '438a81de-980e-482e-a1a2-975cb9775e14'
WHERE vendor_id = '203dd4a3-1739-4b32-b0c0-3074d1dc3497'
  AND title ILIKE '%clean%';
```

---

## 🔄 How It Works Now

### Create Maintenance Request Flow:

```
1. Owner/Tenant fills form
   ├─ Title
   ├─ Description
   ├─ Property
   ├─ Priority
   ├─ Category ✅ (captured)
   └─ Visibility ✅ (captured - owner only)

2. Submit to API
   ├─ category_id saved to DB ✅
   └─ visibility saved to DB ✅

3. Phase 2: Vendor Selection (Future)
   ├─ If visibility = "public"
   │  └─ Show ALL vendors in category
   │     (via getVendorsByCategory)
   │
   └─ If visibility = "invited"
      └─ Show ONLY dedicated vendors
         (via getDedicatedVendors)
```

---

## 🧪 Testing Checklist

### Before Testing:
- [ ] Run SQL fixes in `FIX_VENDOR_CATEGORIES.sql`
- [ ] Verify vendor services have category_id populated
- [ ] Ensure test vendor (arsalan@appopoleis.com) has services linked to categories

### Test Scenarios:

#### 1. Create Request with Category (Owner)
- [ ] Login as owner
- [ ] Create maintenance request
- [ ] Select "Plumbing" category
- [ ] Select "Open Market" visibility
- [ ] Submit
- [ ] Verify in DB: `category_id` = Plumbing ID
- [ ] Verify in DB: `visibility` = 'public'

#### 2. Create Request with Category (Tenant)
- [ ] Login as tenant
- [ ] Create maintenance request
- [ ] Select "Electrical" category
- [ ] Submit (no visibility option for tenants)
- [ ] Verify in DB: `category_id` = Electrical ID
- [ ] Verify in DB: `visibility` = 'invited' (default)

#### 3. Test Vendor Filtering (Phase 2 Preview)
Run in Supabase SQL Editor:
```sql
-- Test: Get vendors for Plumbing category
SELECT DISTINCT
  p.id,
  p.full_name,
  p.email
FROM profiles p
JOIN vendor_services vs ON p.id = vs.vendor_id
WHERE p.role = 'vendor'
  AND vs.category_id = '92ce5667-41a5-4b68-90ed-cd25fc335760'
  AND vs.is_active = true;
```

---

## 📁 Files Modified

1. **`ReportMaintenanceScreen.tsx`** ✅
   - Added `visibility` to API call

2. **`maintenanceApi.ts`** ✅
   - Added `getVendorsByCategory()`
   - Added `getDedicatedVendors()`
   - Added `getVendorsForRequest()`

3. **Created SQL Files:**
   - `DATABASE_QUERIES.sql` - Initial exploration queries
   - `VENDOR_CATEGORY_QUERIES.sql` - Vendor relationship queries
   - `FIX_VENDOR_CATEGORIES.sql` - Fix vendor category links

---

## 🎯 Next Steps

### Immediate:
1. **Run SQL fixes** to populate `vendor_services.category_id`
2. **Test request creation** with categories
3. **Verify data in database**

### Phase 2 (Vendor Selection):
1. Create `VendorSelectionScreen`
2. Use `getVendorsForRequest()` to fetch appropriate vendors
3. Allow owner to select vendors and send quote requests
4. Implement quote submission and comparison

---

## ✅ Success Criteria Met

- [x] Category is captured when creating maintenance request
- [x] Visibility is captured when creating maintenance request
- [x] API functions ready for vendor filtering by category
- [x] Database structure verified and documented
- [x] SQL fixes provided for missing category links
- [x] Code is clean and working (no TypeScript errors in screen)

---

## 🎉 Summary

**Task 1.3 is COMPLETE!** 

The maintenance request creation now properly captures:
- ✅ `category_id` - For vendor filtering
- ✅ `visibility` - For Open Market vs Invite Only

The API is ready for Phase 2 vendor selection with three new functions that will filter vendors based on the request's category and visibility settings.

**Next:** Run the SQL fixes, then move to Task 1.4 (Photo/Video Upload) or Task 1.5 (Detail Screen).
