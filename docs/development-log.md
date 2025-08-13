# Lala Rente Development Log

This log tracks all development work, challenges, and solutions for the Lala Rente tenancy management project.

---

## [2025-08-13] – Contract Templates with Dynamic Variables
**Status:** Started  
**Description:** Introduced `contract_templates` and compiled fields on contracts to support dynamic placeholders (e.g., {{owner.full_name}}, {{tenant.full_name}}, {{property.address}}) populated at creation time, stored alongside the contract, and used for PDF generation.  
**Changes:**  
- Migration `007_contract_templates.sql`:  
  - `contract_templates` table with `title`, `role_scope ('tenancy'|'service')`, `content_html`, `variables_json`, `is_active`, `created_by`, timestamps, and RLS (authenticated read, admin manage).  
  - Added `template_id`, `compiled_html`, `compiled_variables` to `tenancy_contracts` and `service_contracts`.  
  - Seeded two example templates (tenancy, maintenance).  
**Next Steps:**  
- UI: Template picker + live preview for Owner Tenancy creation and Vendor Service creation.  
- Compile placeholders from party/property/lease data before insert; save compiled snapshot.  
- Later: Edge Function to produce final PDF + SHA256 and attach to contract.

---

## [2025-08-13] – E‑Sign Strategy (DocuSign vs. Free Alternatives) and Minimal Contracts UI Plan
**Status:** Completed  
**Description:** Decided on a pragmatic e‑sign path. Keep current signature image MVP, add a simple in‑app signature pad, and design an adapter to integrate external providers. Prioritize a free/self‑hosted option (DocuSeal/OpenSign) or a SaaS free tier (SignRequest/SignWell) for MVP; retain a clean upgrade path to DocuSign for enterprise.  
**Plan:**  
- Phase 1.2: Maintain image‑upload signing; add countersign UIs (done).  
- Phase 1.3: Implement an e‑sign adapter interface with a first provider:  
  - Option A: DocuSeal/OpenSign (self‑hosted).  
  - Option B: SignRequest/SignWell (SaaS free tier).  
  - Backend via Supabase Edge Functions: create envelope/session, return embedded signing URL, receive webhook, store final PDF in Storage, compute SHA256, update contract status and audit logs.  
  - Schema: add `envelope_id`, `envelope_status` to contracts tables.  
- Later: Add DocuSign implementation to the adapter for enterprise needs.  
**Problems:** Cost and complexity of DocuSign at MVP stage; need legally sound audit trail.  
**Solutions:** Start with free/self‑hosted or free‑tier SaaS; design adapter to avoid vendor lock‑in; preserve audit with PDFs and hashes.  
**Next Steps:**  
- Build minimal owner tenancy‑contract creation form; keep vendor service‑contract create flow.  
- Show signatures list on contract detail; auto‑activate when required parties sign.  
- Add simple in‑app signature pad as a UX improvement over file upload.

---

## [2025-08-13] – Owner/Tenant Countersign UIs, Contract Detail (Static Export Safe), Vendor Sign Out
**Status:** Completed  
**Description:** Added owner and tenant contract countersign pages and a shared contract detail page compatible with `output: 'export'`. Implemented Sign out on vendor dashboard. Fixed dashboard loading spinner logic on auth.  
**Changes:**  
- New: `src/app/dashboard/owner/contracts/page.tsx` – lists owner’s service and tenancy contracts, supports file upload to sign.  
- New: `src/app/dashboard/tenant/contracts/page.tsx` – lists tenant’s service and tenancy contracts, supports file upload to sign.  
- New: `src/app/contracts/page.tsx` – contract detail via `?id=<uuid>` to avoid dynamic routes with static export.  
- Removed: `src/app/contracts/[id]/page.tsx`.  
- Updated: `src/components/ProtectedRoute.tsx` – spinner only blocks when no user and not initialized.  
- Updated: `src/app/dashboard/vendor/page.tsx` – added Sign out button (calls `signOut()` and redirects to `/auth/login`).  
**Problems:**  
- Dashboard hung on first load until manual refresh.  
- Contract detail dynamic route failed: missing `generateStaticParams()` under static export.  
**Solutions:**  
- Guard now renders when user exists; only blocks prior to initialization without a user.  
- Replaced dynamic route with query-param page and updated links to `/contracts?id=<uuid>`.  
**Lessons:** With `output: 'export'`, avoid dynamic segments for data-driven routes; prefer query params or pre-generate static params. Auth guards must not gate rendering when a user is already present.  
**Next Steps:**  
- Integrate finalized PDF generation and hashing, then display download in contract detail.  
- Implement owner/tenant signature completeness checks and auto-activate contract on all signatures.  
- Remove temporary casts in vendor dashboard now that Supabase types are up to date.

---

## [2025-08-13] – Vendor Registration, Dashboard Scaffold, Contracts, Auth & Recovery
**Status:** Completed  
**Description:** Implemented vendor public signup page, vendor dashboard scaffold for services and service contracts, password recovery flow, role guard updates, and sign-out UX. Added DB schema for vendor marketplace and service contracts with RLS.
**Problems:**
- NPM EPERM on Windows/OneDrive during `npm ci` unlink.  
- Parse error in `password.ts` due to stray semicolon.  
- Unauthorized redirect after vendor signup (role guard recognized only tenant/owner).  
- TS errors: Supabase types missing new tables (`vendor_services`, `service_contracts`, `service_contract_signatures`) causing overload/type narrowing errors.  
- ESLint warnings for unused vars across dashboards and missing deps.
**Solutions:**
- Recommended `npm install` (not `npm ci`), close locked processes, or move repo out of OneDrive/exclude `node_modules`.  
- Fixed `password.ts` object literal; added `validatePasswordStrength` and enforced in `authStore` and registration pages.  
- Extended `roleValidation` and `ProtectedRoute` to include `vendor`/`admin`; added sign-out in `BottomNavbar`; added optional role selector on login.  
- Created vendor registration page `src/app/auth/register/vendor/page.tsx`; vendor dashboard `src/app/dashboard/vendor/page.tsx` with service create/list and contract create/sign; signature upload to `contracts` bucket.  
- Added migrations: `003_vendor_profile.sql` (service categories, services, areas, availability, documents + RLS) and `004_service_contracts.sql` (contracts, signatures, audit logs + RLS).  
- Resolved TS by loosening vendor dashboard types minimally and casting table names; cleaned unused vars and warnings across files; fixed `migrationRunner` catch param errors.  
- Password recovery: `/auth/forgot-password` (reset email) and `/auth/reset-password` (update password).
**Lessons:** Keep role guards aligned with DB roles; update Supabase TS types when adding tables; avoid `npm ci` on OneDrive; always run `tsc --noEmit` and `npm run lint` before build. With `output: 'export'`, use `npx serve out` to run locally.
**Next Steps:**
- Generate updated Supabase types to include new vendor/contract tables (replace `src/types/supabase.ts`):  
  - GitBash: `npx supabase gen types typescript --project-id <PROJECT_REF> --schema public > src/types/supabase.ts`  
- Owner/Tenant contract countersign UI and contract detail view (integrate `service_contracts` + `service_contract_signatures`).  
- PDF generation for contracts (hashing) and receipt PDFs; admin review flows for vendor KYC.  
- Marketplace discovery (Phase 5): owner/tenant browse vendor services; request-to-job pipeline; quotes and scheduling.  
- UI/UX polish for vendor dashboard and login/register pages.

---

## [2025-08-13] – Policy Update: Public Signup Allowed
**Status:** Completed  
**Description:** Updated project rules and roadmap to reflect that public signup is allowed (with verification and duplicate checks).  
**Changes:**
- Updated `.cursor-rules` Security/Privacy to allow public signup with checks.
- Updated `docs/project-roadmap.md` to reflect public signup in Phase 1 and cross-cutting standards.
**Problems:** Previous docs stated invite-only, causing mismatch with existing flows.  
**Solutions:** Harmonized documentation with current code (existing sign-up pages and `authStore` logic).  
**Lessons:** Keep docs in sync with live flows to avoid confusion.  
**Next Steps:** Proceed with Phase 1.1 validations and guardrails without blocking public signup.

---

## [2025-08-13] – Client Inputs: E‑Signature & Payments Focus
**Status:** Completed  
**Description:** Captured client priorities: paperless rental contracts with easy e‑signing (web and device) and robust notifications/records of payments. Drafted a proposal for e‑signature workflow, storage, and payment notifications.  
**Problems:** Legal audit trail and tamper-evidence needed for signed contracts; delivery guarantees for reminders and receipts.  
**Solutions:** Proposed PDF templating + signature capture + signed artifact hashing and audit logs; notifications via in‑app + email/SMS with retries.  
**Lessons:** Treat contracts as first-class entities with immutable signed artifacts and verifiable audit trails.  
**Next Steps:** Review `docs/esign-payments-spec.md` and approve before schema/UI implementation.

---

## [2025-08-13] – Client Requirements Analysis & Documentation Setup
**Status:** Completed  
**Description:** Analyzed client requirements for notifications, property viewing, earnings reports, YTD data, occupancy calculations, and rental payment arrears. Set up comprehensive documentation structure.  
**Problems:** Client needs clear specifications for complex business logic (occupancy calculations, arrears tracking) and UI mockups for dashboard features.  
**Solutions:** Created detailed specifications for each requirement with database schema implications and UI mockup descriptions. Updated development log with proper tracking format.  
**Lessons:** Always document business logic requirements before implementation to avoid rework. Client needs visual mockups to understand functionality.  
**Next Steps:** Implement notification system schema, create property viewing components, and build earnings report calculations.

---

## [2025-08-13] – Project Setup & Cursor Rules Configuration
**Status:** Completed  
**Description:** Set up project documentation structure and saved Cursor rules for consistent development practices.  
**Problems:** N/A - Initial setup  
**Solutions:** Created .cursor-rules file in root and docs/development-log.md for ongoing tracking.  
**Lessons:** Establish clear development guidelines from the start to maintain consistency.  
**Next Steps:** Review existing codebase structure and identify priority tasks based on schema analysis.

---

## Template for Future Entries

## [YYYY-MM-DD] – Task Title & Description
**Status:** Started / In Progress / Completed  
**Description:** [What was done or attempted]  
**Problems:** [Issues faced, root cause if known]  
**Solutions:** [What fixed it, including code references or commit IDs]  
**Lessons:** [Prevent repeating the same mistakes]  
**Next Steps:** [What comes immediately after this task]

---
