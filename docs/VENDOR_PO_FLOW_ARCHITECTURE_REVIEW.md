# Vendor + Purchase Order Flow — Architecture Review

**Plane Issue:** [#43](https://plane.so) — [AUDIT] Vendor + Send PO flow — architecture review & nav-gap fix (O18)
**Date:** 2026-06-21
**Reviewer:** @claude (please verify)

---

## Source Reference

Per `docs/CLIENT_FEEDBACK_MATRIX.md` — Sheet 1, Owner row O18: *"Send PO | Nav-gap | S2: 'where is this?' — route exists, no menu path"*

---

## Files Audited (15 files across 4 layers)

### Layer 1: Owner Side Screens & Routes

| File | Purpose | Status |
|------|---------|--------|
| `app/(owner)/maintenance/send-po.tsx` | Route — hidden from tabs (`href: null` in `_layout.tsx`) | ✅ Exists, hidden |
| `app/(owner)/maintenance/[id]/po/[poId].tsx` | Route — PO detail screen | ✅ Exists |
| `src/features/owner/screens/OwnerSendPOScreen.tsx` | Full screen: schedule date/time picker, work instructions, send button | ✅ Complete |
| `src/features/owner/screens/OwnerPODetailScreen.tsx` | Full PO detail: cost breakdown, edit mode (with revision tracking), schedule work, send to vendor | ⚠️ Bug (see below) |
| `src/features/owner/screens/OwnerMaintenanceDetailScreen.tsx` | Integrates `RequestPOSection`, calls `acceptQuote` which auto-generates PO | ✅ Complete |
| `src/features/owner/components/RequestPOSection.tsx` | Reusable component showing PO status + "Send PO to Vendor" button | ✅ Complete |

### Layer 2: Vendor Side Screens & Routes

| File | Purpose | Status |
|------|---------|--------|
| `src/features/vendor/screens/VendorPODetailScreen.tsx` | Full PO detail: cost breakdown, revision history, accept/reject buttons | ✅ Complete |
| `src/features/vendor/screens/VendorJobDetailScreen.tsx` | Shows PO section in job detail | ✅ Complete |
| `app/(vendor)/dashboard.tsx` | Vendor dashboard | ✅ Complete |
| `app/(vendor)/maintenance.tsx` | Available maintenance requests | ✅ Complete |
| `app/(vendor)/jobs/[id].tsx` | Job detail with PO integration | ✅ Complete |

### Layer 3: API Layer

| File | Purpose | Status |
|------|---------|--------|
| `src/features/maintenance/api/purchase-orders/poActions.api.ts` | `sendPOToVendor()`, `acceptPO()`, `rejectPO()`, `updatePOStatus()` | ✅ Complete |
| `src/features/maintenance/api/purchase-orders/purchaseOrders.api.ts` | `getPOById()`, `getPOByRequestId()`, `createPO()`, `updatePO()` (with revision tracking) | ✅ Complete |
| `src/features/maintenance/api/purchase-orders/poRevisions.api.ts` | Revision history management | ✅ Complete |
| `src/features/maintenance/api/purchase-orders/poAudit.api.ts` | Audit trail | ✅ Complete |
| `src/features/maintenance/api/types/po.types.ts` | `PurchaseOrder`, `PORevision`, `POCreateData`, `POUpdateData`, etc. | ✅ Complete |

### Layer 4: Vendor Routing

| File | Purpose | Status |
|------|---------|--------|
| `src/features/maintenance/api/vendors/vendorRouting.api.ts` | `pushToOpenMarket()`, `pushToDedicatedVendors()`, `pushToSelectedVendors()`, `inviteVendorByEmail()` | ✅ Complete |
| `src/features/maintenance/api/vendors/vendorDiscovery.api.ts` | Dedicated vendor discovery by property/category | ✅ Complete |
| `src/features/maintenance/api/vendors/vendorQuoteRequests.api.ts` | Quote request lifecycle management | ✅ Complete |
| `src/features/maintenance/api/vendors/vendorMaintenance.api.ts` | Vendor-specific maintenance views | ✅ Complete |

---

## Full Flow (End-to-End)

```
1. Owner creates maintenance request
2. Owner acknowledges request in detail screen
3. Owner pushes to vendors:
   a. Open market (public visibility)
   b. Dedicated vendors (creates quote_requests)
   c. Selected vendors (custom selection)
4. Vendors see request and submit quotes
5. Owner reviews quotes in maintenance detail screen
6. Owner accepts quote → acceptQuote() auto-generates PO (with po_id link)
7. PO appears in RequestPOSection component
8. Owner navigates to PO detail or sends PO directly:
   a. Sets scheduled start date/time
   b. Adds work instructions
   c. Calls sendPOToVendor()
9. Vendor sees PO in their dashboard, can accept/reject
10. If accepted → updatePOStatus('accepted') → maintenance request status → 'assigned'
11. Vendor starts work, submits closure report
12. Owner approves closure → maintenance request → 'completed'
```

---

## Issues Found

### 🔴 Issue 1: O18 Nav-Gap (Client Complaint)
**Source:** `app/(owner)/_layout.tsx:269` — `href: null` — hidden from tab navigation
**Impact:** The Send PO screen is only reachable from within a maintenance request detail → PO detail. There's no direct entry point on the owner dashboard or maintenance list. The client asked "where is this?"
**Recommendation:** Add a "Purchase Orders" entry point on the owner dashboard or maintenance section that lists POs needing action.

### 🟡 Issue 2: OwnerPODetailScreen — DateTimePicker onChange Disconnected
**Source:** `src/features/owner/screens/OwnerPODetailScreen.tsx` (render section)
**Detail:** The `onTimeChange` callback is defined but the TimePicker in the JSX has `// onChange={onTimeChange}` — the TimePicker's onChange is not wired. The DatePicker's `onDateChange` is wired but has a logic issue: `setShowDatePicker(false)` runs for both "set" and "dismissed" events (duplicated).
**Recommendation:** Wire the TimePicker onChange prop and fix the duplicate `setShowDatePicker(false)` call.

### 🟡 Issue 3: OwnerSendPOScreen — Params Passed as Raw Strings
**Source:** `src/features/owner/screens/OwnerSendPOScreen.tsx`
**Detail:** Route params (`poId`, `vendorName`, `totalAmount`, `propertyAddress`, `requestId`) are passed as individual URL params with no validation. If any param is missing, the screen renders with empty values silently.
**Recommendation:** Add param validation and show an error state if required params are missing.

### 🔶 Issue 4: Notifications Not Implemented
**Sources:**
- `src/features/maintenance/api/purchase-orders/poActions.api.ts:177` — `// TODO: Send notification to vendor`
- `src/features/maintenance/api/vendors/vendorRouting.api.ts:100` — `// TODO: Send notifications to vendors`
- `src/features/maintenance/api/vendors/vendorRouting.api.ts:174` — `// TODO: Send notifications to selected vendors`
**Impact:** Vendors are not notified in-app or via push when a PO is sent or a request is routed to them. They must manually refresh to see new items.
**Recommendation:** Implement notification sending through the existing `notificationsApi.sendNotification()` pattern.

### 🔶 Issue 5: VendorPORequestUpdate Not Implemented
**Source:** `src/features/vendor/screens/VendorPODetailScreen.tsx` — `handleRequestUpdate()`
**Detail:** The "Request PO Update" button handler shows an Alert and logs, but the actual API call to notify the owner is marked `// TODO: Implement API to notify owner about update request`.
**Recommendation:** Implement the vendor-to-owner update request API call.

---

## Architecture Assessment

**Overall: SOLID** ✅

The codebase follows a clean layered architecture:
- **Routes** (`app/`) — Thin routing layer, `href: null` for hidden routes
- **Screens** (`src/features/*/screens/`) — UI + state management
- **Components** (`src/features/*/components/`) — Reusable UI pieces
- **API** (`src/features/*/api/`) — Data layer with Supabase integration
- **Types** (`src/features/*/api/types/`) — TypeScript interfaces

The vendor flow is well-separated from the owner flow. Purchase orders have their own API module with revision tracking. Vendor routing has a dedicated API with support for open market, dedicated vendors, and custom selection.

**Key strength:** The `acceptQuote()` function auto-generates the PO and links it to the maintenance request via `po_id`, creating a clean data pipeline from quote → PO → work.

---

## Recommendations

1. **Fix the nav-gap** (O18): Add a "Purchase Orders" section on the owner dashboard or maintenance list with count badges for POs needing action
2. **Fix the TimePicker bug** in OwnerPODetailScreen
3. **Add param validation** to OwnerSendPOScreen
4. **Implement notifications** for PO send/accept/reject and vendor routing
5. **Implement vendor update request** API

---

## @claude — Please Verify

Can you review this architecture assessment and advise on:
1. Is the nav-gap the only real issue, or are there deeper architectural concerns?
2. Should we fix the TimePicker and notification TODOs in the same PR, or scope them separately?
3. Are there any edge cases in the vendor → PO → work → closure flow I missed?
