# Codebuff Analysis — Vendor Flow Gaps & Plane Issues

**Source:** Codebuff CLI analysis session  
**Date:** $(date +"%B %d, %Y")  
**Project:** Lalarente Capacitor Tenant  
**Scope:** REV2/Navin feedback status, vendor flow parity gaps, Plane issue creation, UX placement map

---

## 1. REV2 Plan / Navin's Feedback — Status

All items from the REV2 Implementation Plan (based on `docs/Feedback on Architecture_replyfromNavin_09062026.xlsx`) are resolved:

| Item | Status | PR |
|------|--------|----|
| **🔴 Bug 1:** Keyboard covers input (S2-10) | ✅ Fixed | #10, #16 |
| **🔴 Bug 2:** Tenant lease PDF not visible (S2-24) | ✅ Fixed | #16 |
| **🟡 Item 1:** Arrears/early-termination dashboard shortcuts | ✅ Fixed | #16 |
| **🟡 Item 2:** Deposit card unconditional | ✅ Fixed | #16 |
| **🟡 Item 3:** Empty states on disputes/arrears | ✅ Fixed | #16 |
| **🔶 Tier 3:** PDF upload for income/references (T7) | ✅ Fixed | #7, #17 |
| **Lease PDF template auto-population (S2-07/08)** | ✅ Fixed | #52 |
| **Vendor seed data (S2-13/14)** | ✅ Fixed | #51 |

**Remaining (documentation only):**
- S2-09: Deposit interest calculation walkthrough — explain to client
- S2-06: Affordability ratio (31%) clarification — explain to client

---

## 2. Vendor Flow — Current State

```
OWNER FLOW                                    VENDOR FLOW
────────────                                  ────────────
Create Request → Detail                       
  → Acknowledge                                
  → Push to Vendors                           
     ├─ Open Market (existing)                 → VendorMaintenanceListScreen sees it
     ├─ Dedicated (existing)                      → Review request → Submit Quote
     └─ 🔲 Select Specific (#47) ← GAP 1         
                                                  → Owner reviews quotes
  → Accept Quote → PO created                    → Accept/Reject PO (existing)
  → Send PO (existing)                         → Start Work (existing)
                                                  → Submit Daily Update
  → View progress updates (existing)                ├─ 🔲 Alert.prompt → Form (#46) ← GAP 2
                                                  → Request Closure
  → Approve/Reject closure (existing)                ├─ 🔲 Alert.prompt → Form (#46) ← GAP 2
                                                  → 🔲 Submit Invoice (#48) ← GAP 3
  → 🔲 Approve Invoice / Pay (#48) ← GAP 3
```

### ✅ Fixed Gaps (were flagged in old parity doc, now built)

| What was broken | What's now in code | File |
|----------------|-------------------|------|
| **Owner sends PO** | `OwnerSendPOScreen.tsx` — date/time pickers, work instructions, `sendPOToVendor` API | `src/features/owner/screens/OwnerSendPOScreen.tsx` |
| **Vendor accepts/rejects PO** | `VendorPODetailScreen.tsx` — Accept/Reject buttons, reason modal, Request Update | `src/features/vendor/screens/VendorPODetailScreen.tsx` |
| **Owner approves closure** | `OwnerMaintenanceDetailScreen.tsx` — closure banner, completion notes/photos gallery, Approve/Reject buttons | `src/features/owner/screens/OwnerMaintenanceDetailScreen.tsx` |

---

## 3. Plane Issues Created

| # | Title | ID | Priority | State |
|---|-------|----|----------|-------|
| **#46** | [FEAT] Vendor progress update and closure request forms (replace Alert.prompt) | `a14ac82c-e3b4-44f4-8253-3483fca58cfb` | High | Todo |
| **#47** | [FEAT] Vendor Selection UI — browse, filter, and invite specific vendors | `24e72b88-4374-4251-94dd-76c4f64c35e5` | High | Todo |
| **#48** | [FEAT] Vendor invoice submission and owner payment approval flow | `3eee21e1-501e-435a-8016-05c358cca7c1` | Medium | Todo |

All assigned to **Arsalan** (`b72a887a-5f58-4ada-91dc-2c889a4dd251`).

---

## 4. Gap Details & UX Placement

### GAP 1: Vendor Selection UI (Plane #47 — High)

**What's missing:** Owner can only push to "Open Market" (all vendors in category) or "Dedicated Vendors" (pre-assigned) — there is no screen to browse, filter, compare, or selectively invite vendors by email.

**Current implementation:**
```typescript
// OwnerMaintenanceDetailScreen.tsx — Alert menu only
const handlePushToVendors = () => {
  Alert.alert('Push to Vendors', 'How would you like to route this request?', [
    { text: 'Open Market', onPress: () => pushToOpenMarket(id) },
    { text: 'Dedicated Vendors', onPress: () => pushToDedicatedVendors(id) },
  ]);
};
```

**Where it fits:**
```
OwnerMaintenanceDetailScreen
  → Footer: "Select Vendors" button (replaces current Alert)
    → router.push('/(owner)/maintenance/select-vendors')
      → NEW: VendorSelectionScreen.tsx
        → Two modes: Browse & Email Invite
        → Browse: list vendors filtered by category, show rating/availability, multi-select
        → Invite: email input, searchVendorByEmail(), show profile or send registration invite
      → Back to detail screen
```

**Route to create:** `app/(owner)/maintenance/select-vendors.tsx` (hidden, `href: null`)
**APIs already available:**
- `getVendorsByCategory(categoryId)`
- `getDedicatedVendors(propertyId, categoryId?)`
- `searchVendorByEmail(email)`

---

### GAP 2: Progress Update & Closure Forms (Plane #46 — High)

**What's missing:** `VendorJobDetailScreen.tsx` uses `Alert.prompt` with hardcoded test data and empty/placeholder photo arrays for progress updates and closure requests.

**Current implementation:**
```typescript
// VendorJobDetailScreen.tsx — Alert.prompt + hardcoded data
const handleDailyUpdate = async () => {
  const testNotes = `Progress update - ${new Date().toLocaleTimeString()}`;
  await submitProgressUpdate(id, user.id, testNotes, []); // empty photos!
};

const handleRequestClosure = async () => {
  const testNotes = `Job completed - ${new Date().toLocaleTimeString()}`;
  const testPhotos = ['photo1.jpg', 'photo2.jpg']; // placeholder!
  await requestClosure(id, user.id, testNotes, testPhotos);
};
```

**Where it fits:**
```
VendorJobDetailScreen
  → Footer buttons: [Daily Update] [Request Closure]
    → [Daily Update] → NEW: SubmitProgressUpdateScreen.tsx
      → Notes text area
      → Photo upload (camera/gallery) with preview
      → Submit button → submitProgressUpdate API
    → [Request Closure] → NEW: RequestClosureScreen.tsx
      → Completion notes text area
      → Photo upload (min 2 required) with validation
      → Submit button → requestClosure API
    → Back to VendorJobDetailScreen (refetch)
```

**Routes to create:**
- `app/(vendor)/jobs/[id]/progress-update.tsx`
- `app/(vendor)/jobs/[id]/request-closure.tsx`

**APIs already available:**
- `submitProgressUpdate(requestId, vendorId, notes, photos)`
- `requestClosure(requestId, vendorId, notes, photos)`

---

### GAP 3: Invoice & Payment Flow (Plane #48 — Medium)

**What's missing:** After job closure is approved, there is no invoice submission, approval, or payment flow. A static "Pending Payment" card exists on the owner detail screen but does nothing functional.

**Current implementation:**
```typescript
// OwnerMaintenanceDetailScreen.tsx — static card, no real functionality
{request.status === 'completed' && (
  <TouchableOpacity onPress={() => router.push('/(owner)/invoices')}>
    <Text>Pending Payment</Text>
    <Text>R {request.actual_cost?.toLocaleString() || '0'}</Text>
  </TouchableOpacity>
)}
```

**Where it fits:**
```
// OWNER SIDE:
OwnerMaintenanceDetailScreen
  → Invoice card (when status='completed')
    → router.push('/(owner)/maintenance/[id]/invoice/[invoiceId]')
      → NEW: OwnerInvoiceDetailScreen.tsx
        → View line items, subtotal, VAT, total
        → Approve / Reject buttons
        → Process Payment button (hooks into payment gateway)

// VENDOR SIDE:
VendorJobDetailScreen
  → After closure approved → "Submit Invoice" button appears
    → router.push('/(vendor)/jobs/[id]/submit-invoice')
      → NEW: VendorInvoiceSubmitScreen.tsx
        → Line items (description, qty, unit price)
        → Auto-calculated subtotal, VAT, total
        → Submit to owner
```

**Routes to create:**
- `app/(vendor)/jobs/[id]/submit-invoice.tsx`
- `app/(owner)/maintenance/[id]/invoice/[invoiceId].tsx`

**Database table:** `maintenance_invoices` already exists ✅

---

## 5. Key File Reference

| File | Purpose |
|------|---------|
| `src/features/owner/screens/OwnerMaintenanceDetailScreen.tsx` | Owner maintenance detail — has Push to Vendors (GAP 1), Closure Approval (fixed), Invoice card (GAP 3) |
| `src/features/vendor/screens/VendorJobDetailScreen.tsx` | Vendor job detail — has Daily Update + Request Closure buttons that need proper forms (GAP 2), needs invoice button (GAP 3) |
| `src/features/owner/screens/OwnerSendPOScreen.tsx` | Owner send PO screen — already built ✅ |
| `src/features/vendor/screens/VendorPODetailScreen.tsx` | Vendor PO detail — Accept/Reject buttons already built ✅ |
| `src/features/maintenance/api/purchase-orders/poActions.api.ts` | PO APIs (sendPOToVendor, acceptPO, rejectPO) |
| `src/features/maintenance/api/work/workExecution.api.ts` | submitProgressUpdate API |
| `src/features/maintenance/api/work/workClosure.api.ts` | requestClosure, approveClosureReport, rejectClosureReport APIs |
| `app/(owner)/_layout.tsx` | Owner tab layout — register all new hidden routes here |
| `app/(vendor)/_layout.tsx` | Vendor tab layout — register all new hidden routes here |
