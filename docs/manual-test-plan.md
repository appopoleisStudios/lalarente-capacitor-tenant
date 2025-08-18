# Manual Test Plan – Lala Rente (Web/Mobile)

This document provides concise, role-based manual test flows for all implemented functionality.

## Conventions
- Environments: Local dev (Next.js), Supabase project connected
- Roles: tenant, owner, vendor
- Data: Use seeded/demo users and properties
- Visual checks: Prefer mobile viewport (app is mobile-first)

---

## Vendor – Contract Management

### 1) Vendor Dashboard
- Navigate: `/dashboard/vendor`
- Verify:
  - Dashboard loads; quick actions visible (Contracts)
  - Recent items populated (if data exists)

### 2) Contracts List
- Navigate: `/dashboard/vendor/contracts`
- Actions:
  - Filter by Status: pending_signatures, active, completed
  - Filter by Type/Priority
  - Search by title/address
  - Sort by created_at/value/priority
- Verify:
  - List updates correctly per filter/search/sort
  - Row shows property, owner, status chips, counts

### 3) Contract Detail – Overview/Documents/Timeline/Actions
- Navigate: `/dashboard/vendor/contracts/{id}`
- Overview Tab:
  - Verify header, status/type/priority chips
  - Property and owner/tenant info visible
  - SLA, start/end dates, value, renewal data
- Documents Tab:
  - Upload a file (PDF/PNG/JPG)
  - Enter notes and submit
  - Verify: item appears with filename, size, uploader
- Timeline Tab:
  - Verify audit events listed chronologically
- Notes:
  - Enter vendor notes; Save
  - Verify notes render and persist on reload

### 4) Sign Contract
- Navigate: `/dashboard/vendor/contracts/{id}/sign`
- Actions:
  - Upload signature image
  - Confirm/submit signature
- Verify:
  - Redirect back or confirmation shown
  - Contract status progresses as per business rules

### 5) Update Status
- Navigate: `/dashboard/vendor/contracts/{id}/update-status`
- Actions:
  - Select a new status (e.g., in_progress → completed)
  - Add completion notes/hours (if applicable)
  - Submit
- Verify:
  - Success feedback
  - Status reflected back on detail page

### 6) Request Changes
- Navigate: `/dashboard/vendor/contracts/{id}/request-changes`
- Actions:
  - Select change type (terms/schedule/scope/pricing/other)
  - Select priority (low/medium/high/urgent)
  - Enter detailed description; Submit
- Verify:
  - Success feedback
  - Owner receives a notification (if configured)
  - Contract vendor notes updated (if applicable)

### 7) Message Owner
- Navigate: `/dashboard/vendor/contracts/{id}/message`
- Actions:
  - Select message type (general/question/update/issue/other)
  - Send message; use a quick template; send another
- Verify:
  - Message appears in history (from You)
  - New incoming messages mark as read on open

---

## Owner – Dashboard, Contracts, Maintenance, Income

### 1) Owner Dashboard
- Navigate: `/dashboard/owner`
- Verify:
  - Portfolio metrics (units, occupied, income)
  - Active maintenance list
  - Recent activity items

### 2) Contracts
- Navigate: `/dashboard/owner/contracts`
- Actions:
  - Filter between Tenancy/Service contracts
  - Create new tenancy (when openNew UI is available)
- Verify:
  - New record appears in list
  - Status defaults as expected (pending_signatures)

### 3) Maintenance Requests (Owner)
- Navigate: `/dashboard/owner/maintenance`
- Verify:
  - List shows existing requests with status
  - Quote counts (if any)
- New Request: `/dashboard/owner/maintenance/new`
  - Enter title/description, select property/priority
  - Submit and return to list
  - Verify: item visible; status and visibility correct

### 4) Income & Reports
- Navigate: `/dashboard/owner/income`
- Overview Tab:
  - Monthly income summary (gross/commission/net)
  - Properties and occupancy
  - Arrears alert section if overdue exists
- Payments Tab:
  - Filter by all/paid/pending/overdue
  - Verify tenant name, commission, late fee, dates
- Reports Tab:
  - Click each report option – confirm placeholder download flow
- Arrears Tab:
  - Verify overdue cards show days late, totals with late fees

---

## Tenant – Dashboard, Payments

### 1) Tenant Dashboard
- Navigate: `/dashboard/tenant`
- Verify:
  - Property summary card (rent/next payment)
  - Quick actions present
  - Documents center sections

### 2) Payments
- Navigate: `/dashboard/tenant/payments`
- Overview Tab:
  - Next payment due amount/date (if any)
  - Total arrears (if any)
  - Pay Now button when pending
- History Tab:
  - Filter all/paid/pending/overdue
  - Verify paid items show Download Receipt action (placeholder)
  - Pending items show Pay action routing to `/dashboard/tenant/payments/{id}/pay` (placeholder)
- Methods Tab:
  - Verify existing mock methods
  - Add method button routes to methods/add (placeholder)

---

## Cross-Cutting – Auth, Navigation, UI

### 1) Auth & Role Switch
- Login as vendor/owner/tenant
- Verify correct dashboard loads for each

### 2) Bottom Navigation
- Confirm role-based tabs:
  - Tenant: Home, Search, Payments, Maintenance, Profile
  - Owner: Home, Properties, Tenants, Income, Profile
  - Vendor: Home, Services, Contracts, Profile

### 3) UI Accessibility & Contrast
- Inputs: ensure `text-gray-900` and `placeholder-gray-500`
- Focus states visible (e.g., `focus:border-blue-500`)
- Icons use visible color (`text-gray-500`+)

---

## Data/State Validation
- Refresh pages to confirm persistence (Supabase writes)
- Re-open detail pages to validate updated status/notes/documents/messages

---

## Known Placeholders (to be implemented)
- Tenant: Pay route, payment method add/manage (mocked)
- Owner: Report download actual files
- Receipts: Actual PDF generation and download
- Notifications: Full in-app/email/SMS pipeline
