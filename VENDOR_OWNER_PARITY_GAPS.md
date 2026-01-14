# 🔄 Vendor-Owner Parity Analysis

**Date:** January 11, 2026  
**Status:** 70% Complete - Critical Gaps Identified

---

## 📊 OVERVIEW

The maintenance workflow requires **complete parity** between vendor and owner actions. Currently, the workflow is **70% complete** with **critical gaps blocking the end-to-end flow**.

### Workflow Steps:
1. ✅ Owner creates maintenance request
2. ✅ Owner pushes to vendors
3. ✅ Vendor submits quote
4. ✅ Owner accepts quote
5. ✅ Owner creates PO
6. ❌ **Owner sends PO to vendor** (NO UI)
7. ❌ **Vendor accepts PO** (NO UI)
8. ✅ Vendor starts work
9. ✅ Vendor submits progress updates
10. ✅ Vendor requests closure
11. ❌ **Owner approves closure** (NO UI)
12. ❌ Vendor submits invoice (NOT STARTED)
13. ❌ Owner approves payment (NOT STARTED)

**Blocked Steps:** 6, 7, 11, 12, 13

---

## 🎯 PARITY MATRIX

| Feature | Owner Side | Vendor Side | Status |
|---------|-----------|-------------|--------|
| **View Request** | ✅ Complete | ✅ Complete | ✅ PARITY |
| **Quote Management** | ✅ Complete | ✅ Complete | ✅ PARITY |
| **Create PO** | ✅ API Only | N/A | 🟡 PARTIAL |
| **Send PO** | ❌ Missing UI | N/A | ❌ BLOCKED |
| **View PO** | ✅ Complete | ✅ Complete | ✅ PARITY |
| **Accept/Reject PO** | N/A | ❌ Missing UI | ❌ BLOCKED |
| **Start Work** | N/A | ✅ Complete | ✅ OK |
| **View Progress** | ✅ Complete | N/A | ✅ OK |
| **Submit Progress** | N/A | ✅ Complete | ✅ OK |
| **Request Closure** | N/A | ✅ Complete | ✅ OK |
| **Approve Closure** | ❌ Missing UI | N/A | ❌ BLOCKED |
| **Submit Invoice** | N/A | ❌ Not Started | ❌ MISSING |
| **Approve Invoice** | ❌ Not Started | N/A | ❌ MISSING |
| **Process Payment** | ❌ Not Started | N/A | ❌ MISSING |

---

## 🚨 CRITICAL GAPS (BLOCKING WORKFLOW)

### Gap 1: PO Sending & Acceptance ⚠️
**Priority:** CRITICAL  
**Time:** 4-6 hours  
**Blocks:** Vendor cannot start work

#### Owner Side Missing:
**Screen:** OwnerSendPOScreen.tsx (NEW)

**Features Needed:**
- View PO summary (PO number, total amount, vendor)
- Schedule work section:
  - Date picker (scheduled start date)
  - Time picker (scheduled start time)
  - Work instructions text area
- Send confirmation dialog
- Success message with next steps

**API Already Exists:**
```typescript
sendPOToVendor(
  poId: string,
  scheduledStartDate: string,
  scheduledStartTime: string,
  workInstructions: string | null,
  sentBy: string
)
```

**Navigation:**
- From: OwnerMaintenanceDetailScreen (after accepting quote)
- To: OwnerMaintenanceDetailScreen (after sending)

---

#### Vendor Side Missing:
**Screen:** VendorPODetailScreen.tsx (UPDATE)

**Features Needed:**
- Accept PO button (green, prominent)
- Reject PO button (red, secondary)
- Rejection reason input (Alert.prompt or modal)
- Confirmation dialogs
- Success/error messages

**API Already Exists:**
```typescript
acceptPO(poId: string, vendorId: string)
rejectPO(poId: string, vendorId: string, reason: string)
```

**Current State:**
- Screen exists and displays PO details
- Missing: Action buttons at bottom

**Changes Needed:**
```typescript
// Add to VendorPODetailScreen.tsx
{po.status === 'pending' && (
  <View style={styles.bottomBar}>
    <TouchableOpacity 
      style={styles.rejectButton} 
      onPress={handleRejectPO}
    >
      <Text>Reject</Text>
    </TouchableOpacity>
    <TouchableOpacity 
      style={styles.acceptButton} 
      onPress={handleAcceptPO}
    >
      <Text>Accept PO</Text>
    </TouchableOpacity>
  </View>
)}
```

---

### Gap 2: Job Closure Approval ⚠️
**Priority:** CRITICAL  
**Time:** 3-4 hours  
**Blocks:** Jobs cannot be completed

#### Owner Side Missing:
**Screen:** OwnerMaintenanceDetailScreen.tsx (UPDATE)

**Features Needed:**
- Closure request banner (when vendor requests closure)
- View completion photos in gallery
- Approve closure button (green)
- Reject closure button (red) with reason input
- Confirmation dialogs
- Success messages

**API Already Exists:**
```typescript
approveClosureReport(requestId: string, ownerId: string)
rejectClosureReport(requestId: string, ownerId: string, reason: string)
getClosureReport(requestId: string)
```

**Current State:**
- Screen shows closure status
- Missing: Approve/Reject buttons

**Changes Needed:**
```typescript
// Add to OwnerMaintenanceDetailScreen.tsx
{closureReport && closureReport.status === 'pending' && (
  <View style={styles.closureActions}>
    <Text style={styles.closureTitle}>
      🏁 Vendor has requested job closure
    </Text>
    <Text>Review completion photos and notes below</Text>
    
    {/* Completion Photos Gallery */}
    <MediaGallery images={closureReport.completion_photos} />
    
    {/* Action Buttons */}
    <View style={styles.buttonRow}>
      <TouchableOpacity 
        style={styles.rejectButton}
        onPress={handleRejectClosure}
      >
        <Text>Request Changes</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.approveButton}
        onPress={handleApproveClosure}
      >
        <Text>Approve & Complete</Text>
      </TouchableOpacity>
    </View>
  </View>
)}
```

---

## 🟡 HIGH PRIORITY GAPS (WORKFLOW INCOMPLETE)

### Gap 3: Vendor Selection UI
**Priority:** HIGH  
**Time:** 6-8 hours  
**Impact:** Owner can only push to all vendors, cannot selectively invite

#### Owner Side Missing:
**Screen:** VendorSelectionScreen.tsx (NEW)

**Features Needed:**
- Two modes: Browse & Email Invite
- Browse mode:
  - List vendors filtered by category
  - Show vendor rating, distance, availability
  - Multi-select vendors
  - Send quote request to selected vendors
- Email invite mode:
  - Email input field
  - Search vendor by email
  - If found: Show vendor profile, add to selection
  - If not found: Send invitation to register
- Confirmation before sending

**API Already Exists:**
```typescript
getVendorsByCategory(categoryId: string)
getDedicatedVendors(propertyId: string, categoryId?: string)
searchVendorByEmail(email: string)
```

**Navigation:**
- From: OwnerMaintenanceDetailScreen (after acknowledging request)
- To: OwnerMaintenanceDetailScreen (after sending quote requests)

---

### Gap 4: Better Progress Update Forms
**Priority:** MEDIUM  
**Time:** 2-3 hours  
**Impact:** Poor UX, using Alert.prompt instead of proper forms

#### Vendor Side Missing:
**Screens:** 
- SubmitProgressUpdateScreen.tsx (NEW)
- RequestClosureScreen.tsx (NEW)

**Features Needed:**

**Progress Update Screen:**
- Notes text area
- Photo upload (multiple)
- Preview uploaded photos
- Submit button
- Success message

**Closure Request Screen:**
- Completion notes text area
- Photo upload (minimum 2 required)
- Preview uploaded photos
- Validation (at least 2 photos)
- Submit button
- Success message

**API Already Exists:**
```typescript
submitProgressUpdate(requestId, vendorId, notes, photos)
requestClosure(requestId, vendorId, notes, photos)
```

**Current State:**
- Using Alert.prompt for text input
- Using placeholder photo URLs
- Poor UX

---

## 🔵 POST-MVP GAPS (CAN BE MANUAL INITIALLY)

### Gap 5: Invoice & Payment
**Priority:** MEDIUM  
**Time:** 8-10 hours  
**Impact:** Manual payment handling required

#### Both Sides Missing:

**Vendor Side:**
- VendorInvoiceSubmitScreen.tsx
  - Line items (description, qty, unit price)
  - Subtotal, VAT, total
  - Submit to owner
  
**Owner Side:**
- OwnerInvoiceDetailScreen.tsx
  - View invoice details
  - Approve/Reject invoice
  - Process payment button
  - Payment confirmation

**API to Create:**
```typescript
// invoicesApi.ts
submitInvoice(requestId, vendorId, lineItems, total)
getInvoice(requestId)
approveInvoice(invoiceId, ownerId)
rejectInvoice(invoiceId, ownerId, reason)
processPayment(invoiceId, ownerId, paymentMethod)
```

**Database Table:** Already exists ✅
- `maintenance_invoices`

---

## 📋 IMPLEMENTATION CHECKLIST

### Week 1: Critical Gaps (7-10 hours)
- [ ] **Day 1-2:** PO Sending & Acceptance (4-6h)
  - [ ] Create OwnerSendPOScreen.tsx
  - [ ] Add date/time pickers
  - [ ] Add work instructions field
  - [ ] Integrate sendPOToVendor API
  - [ ] Update VendorPODetailScreen.tsx
  - [ ] Add Accept/Reject buttons
  - [ ] Integrate acceptPO/rejectPO APIs
  - [ ] Test complete PO flow

- [ ] **Day 3:** Job Closure Approval (3-4h)
  - [ ] Update OwnerMaintenanceDetailScreen.tsx
  - [ ] Add closure request banner
  - [ ] Add completion photos gallery
  - [ ] Add Approve/Reject buttons
  - [ ] Integrate approveClosureReport/rejectClosureReport APIs
  - [ ] Test complete closure flow

### Week 2: High Priority Gaps (8-11 hours)
- [ ] **Day 1-2:** Vendor Selection UI (6-8h)
  - [ ] Create VendorSelectionScreen.tsx
  - [ ] Create VendorCard component
  - [ ] Implement browse mode
  - [ ] Implement email invite mode
  - [ ] Integrate vendor APIs
  - [ ] Test vendor selection flow

- [ ] **Day 3:** Progress Update Forms (2-3h)
  - [ ] Create SubmitProgressUpdateScreen.tsx
  - [ ] Create RequestClosureScreen.tsx
  - [ ] Add photo upload
  - [ ] Integrate APIs
  - [ ] Test forms

### Week 3: Post-MVP (Optional, 8-10 hours)
- [ ] **Day 1-2:** Invoice & Payment (8-10h)
  - [ ] Create invoicesApi.ts
  - [ ] Create VendorInvoiceSubmitScreen.tsx
  - [ ] Create OwnerInvoiceDetailScreen.tsx
  - [ ] Integrate payment gateway
  - [ ] Test invoice flow

---

## 🎯 SUCCESS CRITERIA

### Minimum Viable Parity (MVP)
- ✅ Owner can send PO to vendor with schedule
- ✅ Vendor can accept/reject PO
- ✅ Vendor can start work after PO acceptance
- ✅ Vendor can submit progress updates
- ✅ Vendor can request closure
- ✅ Owner can approve/reject closure
- ✅ Job marked as completed after approval

### Complete Parity (Post-MVP)
- ✅ Owner can browse and select specific vendors
- ✅ Vendor can submit invoice
- ✅ Owner can approve invoice
- ✅ Owner can process payment
- ✅ Vendor can view payment status

---

## 📊 PROGRESS TRACKING

**Overall Parity:** 70% Complete

| Category | Progress | Status |
|----------|----------|--------|
| Request Management | 100% | ✅ Complete |
| Quote Management | 100% | ✅ Complete |
| PO Management | 60% | 🚧 Critical Gap |
| Work Execution | 90% | 🟡 Minor Gap |
| Job Closure | 60% | 🚧 Critical Gap |
| Invoice & Payment | 0% | ❌ Not Started |

**Critical Gaps:** 2 (PO, Closure)  
**High Priority Gaps:** 1 (Vendor Selection)  
**Medium Priority Gaps:** 1 (Progress Forms)  
**Post-MVP Gaps:** 1 (Invoice & Payment)

---

## 🚀 NEXT STEPS

### Immediate (This Week)
1. Implement PO sending UI (owner side)
2. Add PO accept/reject buttons (vendor side)
3. Test complete PO flow

### Short-Term (Next Week)
1. Implement closure approval UI (owner side)
2. Test complete closure flow
3. Implement vendor selection UI

### Medium-Term (Next Month)
1. Improve progress update forms
2. Implement invoice & payment (optional)
3. End-to-end testing

---

**Report Generated:** January 11, 2026  
**Last Updated:** January 11, 2026  
**Next Review:** After implementing critical gaps
