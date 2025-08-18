# Backlog – Lala Rente

This backlog tracks what has been delivered and what remains, organized by the agreed sprints.

## Legend
- Status: Completed / In Progress / Pending
- Scope notes link to files and migrations for traceability

---

## Sprint 1: Vendor Contract Management
- Status: Completed
- Delivered:
  - Vendor contracts list and detail (`src/app/dashboard/vendor/contracts/page.tsx`, `[id]/page.tsx`)
  - Contract actions:
    - Sign (`[id]/sign/page.tsx`)
    - Update status (`[id]/update-status/page.tsx`)
    - Request changes (`[id]/request-changes/page.tsx`)
    - Message owner (`[id]/message/page.tsx`)
  - Documents upload/listing (Supabase Storage + `contract_documents`)
  - Notifications/Audit hooks (RPC: `log_contract_event`, `create_contract_notification`)
- Pending:
  - PDF generation for signed contracts; hashed artifact storage
  - Rich signature capture (draw/canvas) in addition to image upload
  - Owner-side contract templates/merge fields

---

## Sprint 2: Maintenance E2E
- Status: In Progress (DB + partial UI)
- Delivered:
  - Owner maintenance list/new (`/dashboard/owner/maintenance`, `/dashboard/owner/maintenance/new`)
  - Vendor jobs intake from maintenance requests (`/dashboard/vendor/jobs`)
  - Quotes creation for requests (`/dashboard/vendor/quotes/new`)
  - DB/RPC: routing to dedicated vendors, PO generation upon quote approval (per docs)
- Pending:
  - Owner quote approval/rejection UI and PO view/download
  - Vendor execution UI (start/pause/complete, attach before/after images)
  - Invoice generation and marking payment → Owner payment reconciliation
  - Full timeline with statuses: approve → PO → execute → invoice → pay

---

## Sprint 3: Vendor KYC & Service Setup
- Status: Pending
- Pending:
  - KYC workflow: profile fields, document upload, verification flags
  - Service catalog: categories, pricing units, base rates
  - Dedicated vendor polish: property/category linking UI; priority, active toggle (owner side implemented; vendor polish pending)

---

## Sprint 4: Owner Portfolio + Reports
- Status: In Progress
- Delivered:
  - Owner income/reports page (`/dashboard/owner/income`) with monthly/YTD/arrears summaries
  - Owner dashboard batched live metrics
- Pending:
  - Advanced filters and global search across properties/tenants
  - Downloadable reports (PDF/CSV) with branding
  - Property performance drilldowns

---

## Sprint 5: Tenant Essentials
- Status: In Progress
- Delivered:
  - Tenant payments page (`/dashboard/tenant/payments`) with arrears logic and history
- Pending:
  - Tenant maintenance request submission and tracking UI
  - Receipt center: actual PDF receipts; email delivery
  - Payment processing integration; add/manage real payment methods

---

## Ongoing: Security, DX, QA
- RLS review/indexes: multiple migrations done; continue per new tables
- Add `data-testid` attributes on key flows (auth, contracts, payments, maintenance)
- Expand Appium coverage to owner/tenant and all critical flows
- Performance: apply batched/parallel querying patterns across remaining pages
- **VD-001**: Vendor Dashboard Data Fetch Lag - Optimize contract loading performance

---

## Cross-Cutting Dependencies
- Supabase functions to secure heavy reads: SECURITY DEFINER RPCs for owner/vendor lists with RLS-safe filters
- PDF generation service for contracts/receipts (Edge function or serverless)
- File storage org: signed artifacts, invoices, receipts under deterministic paths
