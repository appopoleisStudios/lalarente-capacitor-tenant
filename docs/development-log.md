# Lala Rente Development Log

This log tracks all development work, challenges, and solutions for the Lala Rente tenancy management project.

---

## [2025-08-14] – Quotes schema + Submit Quote (vendor) + Active Jobs polish
**Status:** Completed  
**Description:** Introduced minimal Quotes to support MMS flow; added a simple vendor “Submit Quote” page and wired CTA logic on Vendor Home. Cleaned Active Jobs rows by removing property id/address to keep the layout tight and vendor‑focused.
**Changes:**
- DB: `src/lib/migrations/012_quotes.sql` creates `quotes` and `quote_lines` with RLS and party‑based policies.
- Vendor Home: `src/app/dashboard/vendor/page.tsx` now joins quote totals/status and maps a unified row payload.
- Active Jobs list: `src/components/Vendor/ContractsTabs.tsx` hides property line; CTA switches to “Submit Quote” when `quote_status` is `requested` or `change_requested`, else “View Details”.
- Submit Quote page: `src/app/dashboard/vendor/quotes/new/page.tsx` posts a single‑line quote to `quotes` + `quote_lines` and redirects to contract detail.
**Problems:** Supabase types regeneration failed due to a wrapped newline in the CLI command; property id was shown in rows taking space.
**Solutions:** Re‑ran the CLI on one line targeting existing path; removed property label from rows; added conditional CTA.
**Lessons:** Keep CLI commands on a single line; show only the most actionable details in compact list rows; wire CTAs from real state.
**Next Steps:**
- Compute a single friendly status + primary CTA per row (Quote/PO/Exec aware).
- Quotes list under Jobs tab; Quote detail card on contract page.
- Add PO header/lines schema and minimal execution state to complete MMS‑lite.

---

## [2025-08-13] – Vendor Home (Dashboard), seeds, and contract entry flow
**Status:** Completed  
**Description:** Built a modular, data-driven Vendor Home aligned to the approved mobile design; seeded realistic services, contracts, audit/signatures, and payments; defined the production contract flow and entry points.  
**Changes:**
- UI (modular): `src/components/Vendor/{VendorHeader,MetricsStrip,ContractsTabs,QuickActions}.tsx` and refactor of `src/app/dashboard/vendor/page.tsx` to assemble them. Added `BottomNavbar` for vendor with tabs: Dashboard, Jobs, Payments, Analytics, Profile.
- Removed redundant New Job Opportunities card from Home (kept header CTA for a future dedicated page).
- Profile screen: `src/app/dashboard/vendor/profile/page.tsx` with live counts and Sign out.
- Seeds: end‑to‑end SQL that auto‑resolves the Appopoleis vendor, an owner/tenant/properties, then inserts vendor services, three `service_contracts` (pending/active/completed), their signatures and audit logs, and two `payments` (omitting generated columns).  
**Contract flow (Vendor ↔ Owner, optional Tenant):**
- Creation: Owner initiates a service contract (or Vendor proposes a draft) → contract status `pending_signatures`.
- Discovery (Vendor):
  - Home → Active Jobs list rows → “View Details” → `/contracts?id=<uuid>`
  - Quick Actions → My Jobs (same list)
  - Bottom navbar → Jobs (future page of the same lists)
  - Deep link via notifications → `/contracts?id=<uuid>`
- Signing: Vendor opens contract page, reviews Service Summary/Quote/Scope, signs or requests changes. Timeline swaps steps if Vendor signs first. Self-views hidden in activity.
- Activation: auto‑activate when required signatures present; PDF/hash appear.
**Lessons:** Keep dashboard modular; derive metrics from real contracts/payments; remove feature redundancy; use SECURITY DEFINER RPCs for audit writes.  
**Next Steps:**
- Jobs tab page; payments view wired to vendor payout math; quote submission flow from opportunities page.

---

## [2025-08-13] – Tenant Contract Detail UI brought to design parity (Financial Summary, pending banner, request changes)
**Status:** Completed  
**Description:** Implemented the tenant-facing contract screen per provided design. Added a dynamic Financial Summary card, tenant pending banner, Request Changes flow, copy-to-clipboard hash, and preserved step-switching logic and privacy rules for activity.  
**Changes:**
- `src/app/contracts/page.tsx`:
  - Financial Summary card: pulls lease data dynamically from `leases` using `lease_id` on `tenancy_contracts` (fallback: latest lease by `(tenant_id, property_id)`). Displays:
    - Monthly Rent (currency, “Due 1st of each month” microcopy)
    - Security Deposit (currency, ‘Outstanding’ chip)
    - Lease Term (computed months + “Sep 2025 – Aug 2026” formatted range)
  - Pending state banner for tenant: “Your signature is required…” with tenant-green styling.
  - Request Changes: textarea panel, logs `requested_changes` via SECURITY DEFINER RPC (`log_tenancy_contract_event`) and refreshes Activity.
  - Document card: added “Copy” button for SHA256 hash.
  - Step/TImeline: kept dynamic swap so Tenant is default at step 3; if Owner signs first → Owner moves to step 3 and Tenant to step 4 with “Waiting for signature”.
  - Recent Activity privacy: hides self-view events for the current role; actor resolved via `actor_id` vs party ids.
  - Sticky footer: role-themed sign button enablement mirrors signature panel.
**DB alignment:**
- Financial Summary reads from `leases` columns: `rent_amount`, `deposit_amount`, `lease_start`, `lease_end` (no `owner_id`/`due_day`).
- Helper SQL provided to create/reuse leases and link them to contracts via `tenancy_contracts.lease_id`; added RLS example allowing owner (via property ownership) and tenant reads.
**Problems:** The initial schema assumption used `owner_id`, `security_deposit`, `due_day` → caused insert errors and empty card.
**Solutions:** Corrected to `deposit_amount` and removed non-existent fields; robust null handling so the card does not get stuck hidden.
**Lessons:** Always verify table columns from generated Supabase types before writing queries; prefer SECURITY DEFINER RPCs for cross-role logging.
**Next Steps:** Tenant-side polish for Activity filters; realtime updates (supabase channel) for signatures/audit; wire “Download PDF” once generation is ready.

---

## [2025-08-13] – Owner Contract Detail UI refinements (steps, activity, footer) and lint hygiene
**Status:** Completed  
**Description:** Refined the Owner Contract Detail page to exactly match the design and UX rules. Implemented dynamic step ordering, robust Recent Activity with accurate actor mapping, privacy filtering for self-view events, sticky footer theming/enablement rules, and cleared TypeScript/ESLint issues in source.  
**Changes:**
- `src/app/contracts/page.tsx`:
  - Progress timeline: Tenant is the default 3rd step; if Owner signs first, steps 3 and 4 swap (Owner then Tenant) with correct “Waiting for signature” highlights.
  - Recent Activity: write “viewed” on open via SECURITY DEFINER RPCs; query `event, created_at, actor_id`; map actor by comparing to `owner_id/tenant_id/vendor_id`; hide “Viewed by <role>” when the current viewer is the same role.
  - Sticky Footer: always visible; Sign button uses role primary color (Owner blue, Tenant green, Vendor indigo); enabled only when consent + signature input is valid; hidden disabled state for non-signers or after signing.
  - Signature pad: fixed passive event warning; DPR-correct drawing with pointer math.
  - General: removed `@ts-ignore`, added safe touch typing; no linter errors.
- `src/app/dashboard/owner/contracts/page.tsx`:
  - Tenant search: typed RPC result handling; localized disable for `any` on RPC; resolved TS2769 and `length` errors.
- `eslint.config.mjs`: added `ignores` to exclude build artifacts (`.next`, `out`, `dist`, `android`) from linting.
**Problems:**
- Activity card showed “Viewed by tenant” incorrectly due to text parsing; owner saw self-view events.
- Timeline didn’t switch positions when Owner signed first; footer sign button theming inconsistent; massive ESLint noise from build output.
**Solutions:**
- Actor attribution now uses `actor_id` vs party ids; filter self-view events in the UI.
- Timeline logic swapped steps conditionally; footer themed per role and gated by consent/input.
- Moved ignores into flat ESLint config; cleaned source lints and TS in both pages.
**Lessons:** Always derive actor from stable ids, not strings; avoid linting build artifacts; keep UX rules encoded in small pure functions for clarity.
**Next Steps:**
- Tenant/Vendor pages: mirror footer theming; wire “Request changes” flow; add click-to-copy for document hash; adapter spike for DocuSeal/SignRequest.

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
