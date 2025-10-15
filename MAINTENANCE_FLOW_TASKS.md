# 🔧 Complete Maintenance Flow - Implementation Tasks

**Date:** October 15, 2025  
**Status:** In Progress  
**Estimated Time:** 8-12 hours

---

## 📋 COMPLETE FLOW OVERVIEW

```
1. Tenant/Owner reports issue (with photos/videos)
2. Owner acknowledges request
3. Owner pushes to vendors (Open Market OR Invite Only)
4. Vendors submit quotes
5. Owner compares and accepts quote
6. System generates Purchase Order (PO)
7. Work execution tracking
8. Vendor submits completion report
9. Owner closes request
```

---

## ✅ CURRENT STATUS

### **What We Have:**
- [x] OwnerMaintenanceListScreen (with filters)
- [x] ReportMaintenanceScreen (form UI)
- [x] MaintenanceCard component
- [x] StatusBadge component
- [x] Mock data rendering
- [x] Real Supabase authentication
- [x] Architecture properly organized

### **What's Missing:**
- [ ] Backend integration for all screens
- [ ] Role-based dashboard redirection
- [ ] Photo/video upload to Supabase Storage
- [ ] Real-time data fetching
- [ ] Detail screens for each workflow step
- [ ] Vendor-specific screens
- [ ] Tenant-specific screens

---

## 🚀 PHASE 1: Backend Integration & Role Redirection (2-3 hours)

**Goal:** Connect existing screens to real Supabase data and implement role-based navigation

### **Task 1.1: Role-Based Dashboard Redirection** ⏳
**Priority:** HIGH  
**Time:** 30 min

- [ ] 1.1.1 Update LoginScreen to redirect based on user role
  - Owner → `/(owner)/dashboard`
  - Tenant → `/(tenant)/dashboard` (create route)
  - Vendor → `/(vendor)/dashboard` (create route)
- [ ] 1.1.2 Create placeholder tenant dashboard route
- [ ] 1.1.3 Create placeholder vendor dashboard route
- [ ] 1.1.4 Test login flow for all 3 roles

**Files to Modify:**
- `src/features/auth/screens/LoginScreen.tsx`
- `app/(tenant)/_layout.tsx` (create)
- `app/(vendor)/_layout.tsx` (create)

---

### **Task 1.2: Connect useMaintenanceRequests Hook to Real Data** ⏳
**Priority:** HIGH  
**Time:** 45 min

- [ ] 1.2.1 Update `useMaintenanceRequests` hook to fetch from Supabase
- [ ] 1.2.2 Implement role-based filtering (owner/tenant/vendor)
- [ ] 1.2.3 Add error handling and loading states
- [ ] 1.2.4 Add real-time subscriptions for live updates
- [ ] 1.2.5 Test with real database data

**Files to Modify:**
- `src/features/maintenance/hooks/useMaintenanceRequests.ts`
- `src/features/maintenance/api/maintenanceApi.ts`

**Database Tables:**
- `maintenance_requests`
- `profiles`
- `properties`

---

### **Task 1.3: Connect ReportMaintenanceScreen to API** ⏳
**Priority:** HIGH  
**Time:** 1 hour

- [ ] 1.3.1 Implement `createMaintenanceRequest` API call
- [ ] 1.3.2 Connect form submission to API
- [ ] 1.3.3 Add validation and error handling
- [ ] 1.3.4 Show success/error messages
- [ ] 1.3.5 Navigate back to list on success
- [ ] 1.3.6 Test request creation flow

**Files to Modify:**
- `src/features/maintenance/screens/ReportMaintenanceScreen.tsx`
- `src/features/maintenance/api/maintenanceApi.ts`

**API Endpoint:**
- `POST /maintenance_requests`

---

### **Task 1.4: Implement Photo/Video Upload to Supabase Storage** ⏳
**Priority:** HIGH  
**Time:** 1 hour

- [ ] 1.4.1 Create Supabase Storage bucket for maintenance media
- [ ] 1.4.2 Implement upload function in `useMediaUpload` hook
- [ ] 1.4.3 Generate unique file names (UUID)
- [ ] 1.4.4 Upload files to Storage
- [ ] 1.4.5 Get public URLs
- [ ] 1.4.6 Save URLs to maintenance_requests table
- [ ] 1.4.7 Add upload progress indicator
- [ ] 1.4.8 Handle upload errors

**Files to Modify:**
- `src/features/maintenance/hooks/useMediaUpload.ts`
- `src/lib/supabase.ts`

**Supabase Setup:**
- Create bucket: `maintenance-media`
- Set public access policies

---

### **Task 1.5: Create MaintenanceDetailScreen** ⏳
**Priority:** HIGH  
**Time:** 1 hour

- [ ] 1.5.1 Create `OwnerMaintenanceDetailScreen.tsx`
- [ ] 1.5.2 Fetch single request by ID
- [ ] 1.5.3 Display full request details
- [ ] 1.5.4 Show photos/videos gallery
- [ ] 1.5.5 Show timeline/history
- [ ] 1.5.6 Add action buttons (Acknowledge, Push to Vendors, etc.)
- [ ] 1.5.7 Create route `app/(owner)/maintenance/[id].tsx`
- [ ] 1.5.8 Test navigation from list to detail

**Files to Create:**
- `src/features/owner/screens/OwnerMaintenanceDetailScreen.tsx`
- `app/(owner)/maintenance/[id].tsx`

**Files to Modify:**
- `src/features/maintenance/api/maintenanceApi.ts` (add getById)

---

## 🚀 PHASE 2: Vendor Workflow (3-4 hours)

**Goal:** Implement vendor selection, quoting, and PO generation

### **Task 2.1: Create VendorSelectionScreen** 📝
**Priority:** MEDIUM  
**Time:** 1.5 hours

- [ ] 2.1.1 Create `VendorSelectionScreen.tsx` in owner/screens
- [ ] 2.1.2 Fetch vendors filtered by category
- [ ] 2.1.3 Display vendor cards with ratings
- [ ] 2.1.4 Implement multi-select functionality
- [ ] 2.1.5 Add "Open Market" vs "Invite Only" toggle
- [ ] 2.1.6 Send quote requests via WhatsApp/SMS/Email
- [ ] 2.1.7 Update request status to "vendor_routed"
- [ ] 2.1.8 Create route and test flow

**Files to Create:**
- `src/features/owner/screens/VendorSelectionScreen.tsx`
- `src/features/owner/components/VendorCard.tsx`
- `app/(owner)/maintenance/[id]/select-vendors.tsx`

**API Endpoints:**
- `GET /vendors?category_id=X`
- `POST /maintenance_requests/:id/route-to-vendors`

---

### **Task 2.2: Create QuoteComparisonScreen** 📝
**Priority:** MEDIUM  
**Time:** 1.5 hours

- [ ] 2.2.1 Create `QuoteComparisonScreen.tsx` in owner/screens
- [ ] 2.2.2 Fetch all quotes for a request
- [ ] 2.2.3 Display side-by-side comparison
- [ ] 2.2.4 Show vendor ratings & past work
- [ ] 2.2.5 Implement accept/reject actions
- [ ] 2.2.6 Update request with selected vendor
- [ ] 2.2.7 Trigger PO generation on accept
- [ ] 2.2.8 Create route and test flow

**Files to Create:**
- `src/features/owner/screens/QuoteComparisonScreen.tsx`
- `src/features/owner/components/QuoteCard.tsx`
- `app/(owner)/maintenance/[id]/quotes.tsx`

**API Endpoints:**
- `GET /maintenance_requests/:id/quotes`
- `POST /quotes/:id/accept`
- `POST /quotes/:id/reject`

---

### **Task 2.3: Create PurchaseOrderScreen** 📝
**Priority:** MEDIUM  
**Time:** 1 hour

- [ ] 2.3.1 Create `PurchaseOrderScreen.tsx` in owner/screens
- [ ] 2.3.2 Auto-generate PO number
- [ ] 2.3.3 Display PO details (vendor, amount, scope)
- [ ] 2.3.4 Generate PDF (optional)
- [ ] 2.3.5 Send PO to vendor via email/WhatsApp
- [ ] 2.3.6 Update request status to "po_issued"
- [ ] 2.3.7 Create route and test flow

**Files to Create:**
- `src/features/owner/screens/PurchaseOrderScreen.tsx`
- `src/features/owner/components/PODocument.tsx`
- `app/(owner)/maintenance/[id]/purchase-order.tsx`

**API Endpoints:**
- `GET /purchase_orders/:id`
- `POST /purchase_orders/:id/send`

---

## 🚀 PHASE 3: Work Execution (2-3 hours)

**Goal:** Track work progress and completion

### **Task 3.1: Create WorkProgressScreen** 📝
**Priority:** MEDIUM  
**Time:** 1.5 hours

- [ ] 3.1.1 Create `WorkProgressScreen.tsx` (shared or role-specific)
- [ ] 3.1.2 Display timeline view (Scheduled → In Progress → Completed)
- [ ] 3.1.3 Show vendor updates
- [ ] 3.1.4 Allow vendor to upload progress photos
- [ ] 3.1.5 Add status update actions
- [ ] 3.1.6 Real-time updates for all parties
- [ ] 3.1.7 Create routes for owner/vendor views
- [ ] 3.1.8 Test progress tracking

**Files to Create:**
- `src/features/owner/screens/WorkProgressScreen.tsx`
- `src/features/vendor/screens/VendorWorkProgressScreen.tsx`
- `app/(owner)/maintenance/[id]/progress.tsx`
- `app/(vendor)/jobs/[id]/progress.tsx`

**API Endpoints:**
- `GET /maintenance_requests/:id/progress`
- `POST /maintenance_requests/:id/update-status`
- `POST /maintenance_requests/:id/add-update`

---

### **Task 3.2: Create ClosureScreen** 📝
**Priority:** MEDIUM  
**Time:** 1 hour

- [ ] 3.2.1 Create `ClosureScreen.tsx` in owner/screens
- [ ] 3.2.2 Display completion report
- [ ] 3.2.3 Show before/after photos
- [ ] 3.2.4 Upload invoice
- [ ] 3.2.5 Track payment status
- [ ] 3.2.6 Add owner approval/rejection
- [ ] 3.2.7 Archive completed request
- [ ] 3.2.8 Create route and test flow

**Files to Create:**
- `src/features/owner/screens/ClosureScreen.tsx`
- `app/(owner)/maintenance/[id]/close.tsx`

**API Endpoints:**
- `POST /maintenance_requests/:id/complete`
- `POST /maintenance_requests/:id/approve-completion`
- `POST /maintenance_requests/:id/archive`

---

## 🚀 PHASE 4: Testing & Polish (1-2 hours)

**Goal:** End-to-end testing and bug fixes

### **Task 4.1: End-to-End Flow Testing** 📝
**Priority:** HIGH  
**Time:** 1 hour

- [ ] 4.1.1 Test complete flow: Report → Vendor → PO → Work → Close
- [ ] 4.1.2 Test as Owner role
- [ ] 4.1.3 Test as Tenant role
- [ ] 4.1.4 Test as Vendor role
- [ ] 4.1.5 Test real-time updates across roles
- [ ] 4.1.6 Test photo/video uploads
- [ ] 4.1.7 Test error scenarios
- [ ] 4.1.8 Document any bugs found

---

### **Task 4.2: Edge Cases & Error Handling** 📝
**Priority:** MEDIUM  
**Time:** 30 min

- [ ] 4.2.1 Handle no vendors available
- [ ] 4.2.2 Handle quote rejection by all vendors
- [ ] 4.2.3 Handle network errors
- [ ] 4.2.4 Handle upload failures
- [ ] 4.2.5 Add proper loading states everywhere
- [ ] 4.2.6 Add error messages and retry options
- [ ] 4.2.7 Test offline behavior

---

### **Task 4.3: UI/UX Polish** 📝
**Priority:** LOW  
**Time:** 30 min

- [ ] 4.3.1 Add animations and transitions
- [ ] 4.3.2 Improve loading states
- [ ] 4.3.3 Add empty states
- [ ] 4.3.4 Improve error messages
- [ ] 4.3.5 Add success confirmations
- [ ] 4.3.6 Test on different screen sizes
- [ ] 4.3.7 Final UI review

---

## 📊 PROGRESS TRACKER

| Phase | Tasks | Estimated Time | Status |
|-------|-------|----------------|--------|
| **Phase 1** | Backend Integration | 2-3 hours | ⏳ **NEXT** |
| **Phase 2** | Vendor Workflow | 3-4 hours | 📝 Planned |
| **Phase 3** | Work Execution | 2-3 hours | 📝 Planned |
| **Phase 4** | Testing & Polish | 1-2 hours | 📝 Planned |
| **TOTAL** | | **8-12 hours** | |

---

## 🎯 CURRENT FOCUS: PHASE 1 - Task 1.1

**Next Action:** Implement role-based dashboard redirection after login

**Command to Start:**
```bash
cd lalarente-app
npx expo start
```

---

## 📝 NOTES

### **Architecture Compliance:**
- ✅ Data layer in `features/maintenance/`
- ✅ Owner UI in `features/owner/screens/`
- ✅ Tenant UI in `features/tenant/screens/`
- ✅ Vendor UI in `features/vendor/screens/`
- ✅ Shared components in `features/maintenance/components/`

### **Database Tables Needed:**
- `maintenance_requests` ✅ (exists)
- `quotes` (create)
- `purchase_orders` (create)
- `work_updates` (create)
- `vendors` (create or use profiles)

### **Supabase Storage:**
- `maintenance-media` bucket (create)
- Public access for images
- Authenticated access for documents

---

## ✅ COMPLETION CRITERIA

- [ ] All 3 roles can login and see appropriate dashboard
- [ ] Owner can create maintenance requests
- [ ] Tenant can create maintenance requests
- [ ] Owner can push requests to vendors
- [ ] Vendors can submit quotes
- [ ] Owner can compare and accept quotes
- [ ] System generates PO automatically
- [ ] Vendor can update work progress
- [ ] Owner can close completed requests
- [ ] Real-time updates work across all roles
- [ ] Photos/videos upload successfully
- [ ] All error cases handled gracefully

---

**Ready to start Phase 1! 🚀**
