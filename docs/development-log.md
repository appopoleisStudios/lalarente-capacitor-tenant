# Lala Rente Development Log

This log tracks all development work, challenges, and solutions for the Lala Rente tenancy management project.

---

## [2025-08-15] – Auth UI, RLS/RPC Hardening, Vendor Jobs (Public vs Invited), Mobile Sizing
**Status:** Completed  
**Scope:** Auth screens UX, Owner Maintenance flow stability, DB policies/functions, Vendor Jobs logic, mobile responsiveness  

### Issues Observed
- Login screen button was invisible (custom class names not in Tailwind config). Inputs across auth pages had light text.  
- Owner maintenance list failed with `42P17 infinite recursion detected in policy for relation "maintenance_requests"`.  
- Creating a maintenance request failed with `42702 column reference "request_id" is ambiguous` in RPC.  
- Vendor Jobs showed no open jobs due to RLS and invitation scoping; also page had black side margins on mobile.  

### Solutions Implemented
1) Auth UX
- Inputs on login/forgot/reset screens: enforced `text-gray-900 placeholder-gray-500` for readability.  
- Sign-in button: switched Button defaults to Tailwind colors; made it large and full-width.  
- Dynamic role color on Sign-in button (tenant=emerald, owner=blue, vendor=indigo, admin=red).  
- Owner profile page added a Sign out button; `signOut()` now redirects to `/auth/login`.  
  - Files: `src/app/auth/login/page.tsx`, `src/app/auth/forgot-password/page.tsx`, `src/app/auth/reset-password/page.tsx`, `src/components/ui/Button.tsx`, `src/app/owner/profile/page.tsx`, `src/store/authStore.ts`.  

2) RLS: remove recursion and split per command
- Replaced prior `FOR ALL`/recursive policies with explicit non-recursive policies per actor (owner/tenant/vendor) and per command (select/insert/update).  
- Vendor read: can see requests if invited via `vendor_quote_requests`, if directly assigned (`selected_vendor_id`), or if `visibility='public'`.  
- Audit logs: insert allowed when `actor_id = auth.uid()`.  

3) RPC: parameter ambiguity fix
- `route_maintenance_request_to_vendors` renamed parameters to `p_request_id`, `p_quote_deadline_hours` and updated client calls to avoid 42702 ambiguity.  

4) Visibility model for open market
- Added `visibility text check in ('public','invited','private') default 'invited'` and optional `category_id` to `maintenance_requests`; indexed both.  
- Backfilled routed requests without invitations to `visibility='public'`.  

5) Vendor Jobs logic per business rules
- Current Jobs: union of (a) invited to quote via VQR and (b) directly assigned (`selected_vendor_id=user.id`), plus existing service contracts mapping.  
- All Open Jobs: `visibility='public' AND mms_status='vendor_routed'` excluding already invited/assigned to this vendor.  
- Files: `src/app/dashboard/vendor/jobs/page.tsx`.  

6) Mobile responsiveness
- Jobs page container uses full viewport width (`mobile-app w-[100vw]`) and navbar uses `w-full`; removes side gutters on device screens.  
- Files: `src/app/dashboard/vendor/jobs/page.tsx`, `src/components/BottomNavbar.tsx`, `src/app/globals.css`.  

### Database Changes (codified)
- New migration: `src/lib/migrations/019_rls_and_rpc_fixes.sql` capturing:  
  - RPC redefinition with disambiguated params and grants  
  - Non-recursive RLS policies for `maintenance_requests`, vendor policy, VQR vendor policy, audit insert policy  
- Visibility additions and backfill executed manually (recorded here for reproducibility):  
  - `ALTER TABLE maintenance_requests ADD COLUMN visibility ...; ADD COLUMN category_id uuid ...;`  
  - `UPDATE maintenance_requests SET visibility='public' ...` for routed-but-uninvited requests.  

### Developer Notes / Guardrails
- Avoid embedded joins in Supabase queries on RLS-protected tables; fetch base rows then hydrate related data in separate queries or use SECURITY DEFINER RPCs.  
- Do not reference `maintenance_requests` from policies on `vendor_quote_requests` (and vice versa) to prevent recursion.  
- In PL/pgSQL, prefix parameters (e.g., `p_request_id`) to avoid column/variable ambiguity.  
- DB-first: confirm columns, constraints, and policies before writing client code.  

### Next Steps
- Owner Maintenance → New: add a “Post to Open Market” toggle (sets `visibility='public'`), and “Post to My Vendor” when a long-term vendor is linked.  
- Add SECURITY DEFINER RPC for owner maintenance list to avoid any future RLS regressions.  
- Tests: implement unit/integration/E2E (web + Appium) across roles (tenant/owner/vendor/admin).  

## [2025-08-15] – MMS Flow Integration & Maintenance Request System
**Status:** Completed  
**Description:** Implemented complete MMS (Maintenance Management System) flow integration connecting maintenance_requests to quotes, purchase orders, and vendor routing. Created owner maintenance request creation and management UI.
**Problems:**
- Vendor jobs page showing placeholder data instead of real maintenance requests
- No connection between maintenance_requests and the MMS workflow
- Missing owner interface for creating and managing maintenance requests
- Quote submission only worked for service contracts, not maintenance requests
**Solutions:**
- Created migration `016_mms_flow_integration.sql` to enhance maintenance_requests with MMS fields
- Added dedicated_vendors, maintenance_request_audit_logs, and vendor_quote_requests tables
- Implemented RPC functions for vendor routing and quote approval workflows
- Created owner maintenance request creation page (`/dashboard/owner/maintenance/new`)
- Created owner maintenance requests list page (`/dashboard/owner/maintenance`)
- Updated vendor jobs page to show real maintenance requests instead of placeholder data
- Enhanced quote submission to handle both contract_id and request_id
- Created test data migration `017_mms_test_data.sql` with service categories and sample requests
**Code Changes:**
- New files: `src/app/dashboard/owner/maintenance/new/page.tsx`, `src/app/dashboard/owner/maintenance/page.tsx`
- Updated: `src/app/dashboard/vendor/jobs/page.tsx` to load real maintenance requests
- Updated: `src/app/dashboard/vendor/quotes/new/page.tsx` to handle request_id parameter
- New migrations: `016_mms_flow_integration.sql`, `017_mms_test_data.sql`
**MMS Flow Implemented:**
1. **Notification Raised**: Owner creates maintenance request
2. **Acknowledged**: Owner reviews and acknowledges request
3. **Vendor Routed**: System routes to dedicated vendors via `route_maintenance_request_to_vendors` RPC
4. **Quote Received**: Vendors submit quotes for maintenance requests
5. **PO Issued**: Owner approves quote, system generates PO via `approve_quote_and_generate_po` RPC
6. **Work In Progress**: Vendor starts execution
7. **Completed**: Work finished and closed
**Test Results:**
- Owner can create maintenance requests with property selection, priority, and description
- Vendor jobs page shows real maintenance requests in "All Open Jobs" section
- Quote submission works for both service contracts and maintenance requests
- MMS status tracking and audit logging implemented
**Lessons:** 
- MMS flow requires careful status tracking and audit logging
- Vendor routing should be based on dedicated vendor assignments
- Quote approval workflow should automatically generate POs
- Test data essential for demonstrating complex workflows
**Next Steps:** Implement quote approval/rejection UI for owners, job execution interface for vendors, and closure workflow.

---

## [2025-08-15] – RLS Recursion and RPC Ambiguity Fixes (MMS Hardening)
**Status:** Completed  
**Description:** Resolved owner maintenance page failures caused by RLS policy recursion (42P17) and request creation failures caused by RPC parameter ambiguity (42702). Codified fixes in a migration for reproducibility.
**Problems:**
- Owner Maintenance list error: `42P17 infinite recursion detected in policy for relation "maintenance_requests"` due to cyclic RLS between `maintenance_requests` and `vendor_quote_requests`.
- New request creation error: `42702 column reference "request_id" is ambiguous` in `route_maintenance_request_to_vendors` (PL/pgSQL variable/column name clash).
**Solutions:**
- Replaced recursive/ALL RLS policies with explicit per-command rules; removed owner-read on `vendor_quote_requests` that referenced `maintenance_requests`.
- Disambiguated RPC parameters (`p_request_id`, `p_quote_deadline_hours`) and updated frontend call.
- Avoid embedded joins in client; hydrate related data with separate queries to respect RLS.
- Captured changes in `src/lib/migrations/019_rls_and_rpc_fixes.sql`.
**Code Changes:**
- New migration: `019_rls_and_rpc_fixes.sql` (RLS refactor + RPC redefine + grants).
- UI: `src/app/dashboard/owner/maintenance/new/page.tsx` calls RPC with new param names and adds clearer error logs.
- UI: `src/app/dashboard/owner/maintenance/page.tsx` refactored to base fetch + hydrate properties/vendors without embedded joins.
**Lessons:**
- Never reference the same table from within its RLS policy via subqueries to other RLS-protected tables; use SECURITY DEFINER RPCs or views if needed.
- In PL/pgSQL, avoid parameter names that collide with column names.
**Next Steps:**
- Optionally add a SECURITY DEFINER RPC for owner’s read-only view of vendor quote requests without reintroducing recursion.
- Extend tests to assert that queries avoid embedded joins on RLS tables.

---

## [2025-08-15] – Appium Mobile Testing Implementation & Chromedriver Resolution
**Status:** Completed  
**Description:** Successfully implemented automated mobile testing using Appium/WebdriverIO for Android APK. Resolved chromedriver compatibility issues and created comprehensive vendor login flow test.
**Problems:**
- Chromedriver version mismatch: Device Chrome 138.0.7204.179 but no compatible chromedriver found
- Appium port conflicts: Multiple instances blocking port 4723
- WebView context switching failures due to chromedriver issues
- Role dropdown interaction challenges in mobile WebView
**Solutions:**
- Started Appium with `--allow-insecure chromedriver_autodownload` flag
- Killed conflicting processes: `taskkill //PID <PID> //F` (Git Bash syntax)
- Removed `autoWebview` capability and implemented manual context switching
- Enhanced test with multiple fallback strategies for role selection
- Added comprehensive logging and error handling with screenshots
**Code Changes:**
- Updated `tests/mobile/vendor-smoke.js` with robust WebView/native automation
- Added `data-testid="vendor-dashboard"` to vendor dashboard for easier detection
- Improved login page role dropdown handling with multiple interaction methods
**Test Results:**
```
✅ App launched successfully
✅ WebView context detected and switched
✅ Login form found and filled
✅ Vendor role selected from dropdown
✅ Login submitted successfully
✅ Vendor dashboard loaded (found: h2=Job Overview)
✅ Test completed without errors
```
**Lessons:** 
- Always use chromedriver auto-download for mobile WebView testing
- Manual context switching is more reliable than automatic
- Multiple fallback strategies essential for mobile UI automation
- Comprehensive logging crucial for debugging mobile test issues
**Next Steps:** Expand test coverage to other user roles (owner, tenant) and critical app flows (contracts, payments, jobs).

---

## [2025-08-14] – Android APK build (Capacitor) on Windows/OneDrive
**Status:** Completed  
**Description:** Built Android APK via Gradle/Android Studio without breaking the static-export Next.js setup.
**Problems:**
- Gradle clean failed: Unable to delete directory under `android/build` and `app/build` due to file locks (OneDrive/Java/Gradle daemons holding files).
**Solutions:**
- Stop holders: `./gradlew --stop`, `adb kill-server`, close Android Studio/emulators; pause OneDrive sync.
- Force-delete: remove `android/build` and `android/app/build` via `rm -rf` or `rmdir /S /Q`.
- Re-run: `./gradlew clean`, then `./gradlew assembleDebug` (or `bundleRelease`).
**Lessons / Next time:**
- Prefer project path outside OneDrive or exclude from sync; keep `capacitor.config.ts` `webDir: 'out'`, `server.androidScheme: 'https'`.
- Build steps: `npx next build` → `npx cap sync android` → Gradle assemble.

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
