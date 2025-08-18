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

## [2025-08-16] – Vendor Contract Management System (Sprint 1)
**Status:** Completed  
**Description:** Implemented comprehensive vendor contract management system with contract listing, detail views, document management, and electronic signing capabilities.
**Features Implemented:**
1. **Enhanced Database Schema**: Added contract management fields to service_contracts table
2. **Contract List Page**: Vendor can view all contracts with filtering, search, and sorting
3. **Contract Detail Page**: Comprehensive contract view with tabs for overview, documents, timeline, and actions
4. **Document Management**: Upload, download, and manage contract documents with version control
5. **Electronic Signing**: Signature upload and contract activation workflow
6. **Notifications & Audit Logs**: Track contract events and notify parties of status changes
7. **Dashboard Integration**: Added contracts quick action to vendor dashboard

**Database Changes:**
- Migration `020_vendor_contract_management.sql`: Enhanced service_contracts with contract_value, sla_hours, renewal_date, auto_renew, termination_notice_days, vendor_notes, owner_notes, estimated_duration_hours, actual_duration_hours, vendor_rating, vendor_feedback, owner_rating, owner_feedback
- New tables: contract_documents, contract_notifications, contract_management_audit_logs, service_contract_signatures
- RPC functions: log_contract_event, create_contract_notification

**Code Changes:**
- New files: 
  - `src/app/dashboard/vendor/contracts/page.tsx` (contract list)
  - `src/app/dashboard/vendor/contracts/[id]/page.tsx` (contract detail)
  - `src/app/dashboard/vendor/contracts/[id]/sign/page.tsx` (signing page)
- Updated: `src/app/dashboard/vendor/page.tsx` (added contracts quick action)
- Updated: `src/components/Vendor/ContractsTabs.tsx` (linked to new contracts page)

**Contract Management Features:**
- **Status Tracking**: draft → pending_signatures → active → completed/terminated/expired
- **Document Upload**: Support for multiple file types with notes and versioning
- **Electronic Signing**: Image-based signature upload with legal compliance
- **Notifications**: Real-time notifications for status changes and document uploads
- **Audit Trail**: Complete history of all contract events and changes
- **Filtering & Search**: By status, type, priority, and text search
- **Mobile Responsive**: Optimized for mobile app usage

**Next Steps:**
- Owner contract creation interface

---

## [2025-08-16] – Vendor Contract Messaging System & RLS Policy Fixes
**Status:** Completed  
**Description:** Implemented vendor contract messaging functionality and resolved critical RLS policy issues that were blocking message sending.

### Critical Issues Encountered & Resolved

#### 1. **Initial Data Loading Errors**
**Problem:** Vendor contract detail page showed "Joined contract load failed", "Property direct query error", "Tenant direct query error"
**Root Cause:** RLS policies blocking vendor access to property and profile data
**Solution:** 
- Initially attempted RPC-first approach with direct query fallbacks
- Switched to direct Supabase queries with proper error handling
- Made related data errors non-fatal (logged as warnings)

#### 2. **Timeline Design Mismatch**
**Problem:** Vendor contract timeline was horizontal instead of vertical signature-driven design
**Root Cause:** Incorrect timeline implementation not matching owner/tenant contract designs
**Solution:** 
- Researched owner/tenant contract pages and design patterns
- Replaced horizontal "Status Timeline" with vertical "Contract Progress" timeline
- Implemented signature-driven step logic based on `service_contract_signatures`
- Added conditional step ordering (vendor/owner signature order)

#### 3. **Redundant Sign Contract Button**
**Problem:** "Sign Contract" button appeared in both contract list and detail views
**Root Cause:** Poor business logic implementation
**Solution:** 
- Removed redundant button from contract list page
- Implemented conditional rendering in detail view based on signature status
- Added business logic: show "Sign Contract" only if vendor hasn't signed

#### 4. **Persistent Message Loading Error**
**Problem:** "Error loading messages: {}" on vendor contract message page
**Root Cause:** Multiple issues:
- **Relationship ambiguity**: `sender:profiles(id, full_name)` had multiple relationships
- **RLS policy issue**: Vendor couldn't insert messages due to incorrect policy
- **Missing RPC types**: Functions existed but weren't typed in TypeScript

**Solutions Implemented:**

**A. Relationship Ambiguity Fix:**
```typescript
// Before (ambiguous)
sender:profiles(id, full_name)

// After (explicit)
sender:profiles!messages_sender_id_fkey(id, full_name)
```

**B. RLS Policy Analysis & Fix:**
- **Discovered**: Existing policies used `properties.assigned_vendor_id` which doesn't exist
- **Root Cause**: Vendor-property relationship is through `dedicated_vendors` table, not `assigned_vendor_id`
- **Solution**: Updated RLS policy to use correct relationship:

```sql
-- Drop existing incorrect policy
DROP POLICY "messages_insert_access" ON public.messages;

-- Create corrected policy using service_contracts relationship
CREATE POLICY "messages_insert_access" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND (
            property_id IN (
                SELECT id FROM public.properties 
                WHERE owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.service_contracts sc 
                    WHERE sc.property_id = properties.id 
                    AND sc.vendor_id = auth.uid()
                )
            )
        )
    );
```

**C. TypeScript RPC Function Types:**
- **Problem**: `create_contract_notification` and `log_contract_event` functions existed but weren't typed
- **Solution**: Added missing function types to `src/types/supabase.ts`:

```typescript
create_contract_notification: {
  Args: { 
    p_contract_id: string; 
    p_recipient_id: string; 
    p_notification_type: string; 
    p_title: string; 
    p_message: string 
  }
  Returns: undefined
},
log_contract_event: {
  Args: { 
    p_contract_id: string; 
    p_event: string; 
    p_actor_id?: string; 
    p_old_values?: Json; 
    p_new_values?: Json 
  }
  Returns: undefined
}
```

**D. TypeScript Null Safety Fix:**
- **Problem**: `p_recipient_id` parameter expected `string` but received `string | null`
- **Solution**: Added null check before calling RPC function:

```typescript
// Only create notification if we have a valid recipient
if (contract.owner?.id) {
  await supabase.rpc('create_contract_notification', {
    p_contract_id: contract.id,
    p_recipient_id: contract.owner.id, // Now guaranteed to be string
    p_notification_type: 'message',
    p_title: 'New Message from Vendor',
    p_message: `You have received a new message from the vendor regarding contract "${contract.title}".`
  })
}
```

### Database Schema Analysis & Lessons Learned

#### **Messages Table Structure:**
```typescript
messages: {
  Row: {
    attachments: string[] | null
    content: string
    created_at: string | null
    id: string
    message_type: string | null
    property_id: string | null  // Links to properties table
    read_at: string | null
    recipient_id: string | null // Links to profiles table
    sender_id: string | null    // Links to profiles table
  }
}
```

#### **Key Relationships Discovered:**
- **Vendor → Property**: Through `service_contracts` table (`vendor_id` → `property_id`)
- **Messages → Property**: Direct relationship via `property_id`
- **Messages → Profiles**: Dual relationship via `sender_id` and `recipient_id`

### Code Changes Made

#### **Files Modified:**
1. **`src/app/dashboard/vendor/contracts/view/page.tsx`**
   - Fixed data loading with proper error handling
   - Implemented vertical signature-driven timeline
   - Added conditional action buttons based on signature status
   - Removed redundant "Sign Contract" button

2. **`src/app/dashboard/vendor/contracts/page.tsx`**
   - Removed redundant "Sign Contract" button from contract cards

3. **`src/app/dashboard/vendor/contracts/message/page.tsx`**
   - Fixed messages query with explicit relationship specification
   - Updated to use `property_id` instead of `contract_id`
   - Added null safety for RPC function calls
   - Enhanced error handling and logging

4. **`src/types/supabase.ts`**
   - Added missing RPC function types for `create_contract_notification` and `log_contract_event`

#### **Files Deleted:**
- Removed old route structure: `src/app/dashboard/vendor/contracts/[id]/` (replaced with query parameter approach)

### Business Logic Implemented

#### **Contract Action Visibility Rules:**
```typescript
// Show "Sign Contract" only if:
contract.status === 'pending_signatures' && !vendorHasSigned

// Show "Send Message to Owner" only if:
contract.status === 'pending_signatures' && vendorHasSigned && !ownerHasSigned

// Otherwise: no Actions block
```

#### **Timeline Step Logic:**
```typescript
const vendorSig = sigs.find(s => s.signer_role === 'vendor');
const ownerSig = sigs.find(s => s.signer_role === 'owner');
const vendorHasSigned = !!vendorSig;
const ownerHasSigned = !!ownerSig;

// Conditional step ordering based on who signed first
const steps = [
  { key: 'created', label: 'Created', state: 'done' },
  { key: 'sent', label: 'Sent', state: 'done' },
  vendorHasSigned && !ownerHasSigned ? vendorStep : ownerStep,
  vendorHasSigned && !ownerHasSigned ? ownerStep : vendorStep,
  { key: 'active', label: 'Active', state: activeState },
];
```

### Critical Lessons Learned & Rules Established

#### **1. Database-First Development Rule**
**Problem**: Made assumptions about table structure and relationships
**Solution**: Always check existing database schema, policies, and relationships before making changes
**Rule Added**: "CRITICAL: Always check existing database state (tables, policies, functions, triggers, RLS) before suggesting any database changes or code modifications."

#### **2. Error Resolution Rule**
**Problem**: Jumped to solutions without proper analysis
**Solution**: Systematic approach to error resolution
**Rule Added**: "ERROR RESOLUTION RULE: Before fixing any TypeScript/lint errors, always: 1) Check database schema and relationships, 2) Review development logs and documentation, 3) Examine related files and table structures, 4) Remember this is a mobile app project using Capacitor"

#### **3. RLS Policy Analysis Pattern**
**Problem**: Created policies without checking existing ones
**Solution**: Always check existing policies first using:
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'messages';
```

#### **4. TypeScript RPC Function Management**
**Problem**: RPC functions existed but weren't typed
**Solution**: Always verify RPC functions are properly typed in `src/types/supabase.ts`

### Mobile App Context Maintained
- All changes prioritized mobile-first UI patterns
- Maintained Capacitor compatibility
- Used mobile-optimized layouts and interactions
- Preserved existing mobile navigation patterns

### Testing & Validation
- **Messages Functionality**: ✅ Working - vendors can send/receive messages
- **Contract Timeline**: ✅ Working - vertical signature-driven design
- **Action Buttons**: ✅ Working - conditional rendering based on signature status
- **TypeScript**: ✅ Clean - no type errors
- **RLS Policies**: ✅ Working - proper vendor access to messages

### Next Steps for Debug Build
- Ready for mobile testing on device
- All vendor contract messaging features functional
- Mobile-optimized interface complete
- Database policies properly configured

### Files Ready for Build
- `src/app/dashboard/vendor/contracts/view/page.tsx` - Fixed timeline and actions
- `src/app/dashboard/vendor/contracts/message/page.tsx` - Fixed messaging
- `src/types/supabase.ts` - Added RPC function types
- RLS policies updated in database

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

## [2025-08-16] – Dedicated Vendors Model Finalization & Routing Defaults
**Status:** Completed  
**Description:** Confirmed business meaning and implementation approach for Dedicated Vendors. These represent long‑term/retainer vendors linked to an owner per property (optionally by service category), typically backed by an active service contract. Clarified default routing behavior and UI backlog.

**What we finalized:**
- Dedicated Vendors definition: owner’s preferred/retainer vendors per property (+ optional `category_id`).
- Lifecycle linkage: activating a service contract Owner↔Vendor for a property/category should create or re‑enable a corresponding `dedicated_vendors` row (`is_active=true`, `priority` from contract if available). Ending/terminating the contract should set `is_active=false`.
- Manual curation allowed: owners can add/remove/toggle preferred vendors even before a contract; when a contract is later signed, we link/sync the record.

**Routing behavior (MMS):**
- When owner selects “Invite Vendors” without listing specific vendors, the system auto‑invites all active dedicated vendors for the request’s `property_id` (and `category_id` when set) via `route_maintenance_request_to_vendors`.
- If no dedicated vendors exist, fallback is open market (`visibility='public'`).

**RLS/DB status (already in repo):**
- `dedicated_vendors` table with indices and RLS policies for owner manage + vendor read (see `016_mms_flow_integration.sql`).
- `route_maintenance_request_to_vendors` RPC inserts `vendor_quote_requests` from `dedicated_vendors` and advances MMS status to `vendor_routed`.

**UI backlog additions:**
- Property → “Dedicated Vendors” tab: list, filter by category, show linked contract, priority chip, toggle `is_active`, add/remove vendors.
- Owner Maintenance → New Request: “Invite my dedicated vendors” default toggle; if none exist, show hint that request will be public.
- Service Contract activation/termination hook: reflect in `dedicated_vendors` automatically.

**Business rules notes:**
- VAT line appears only if vendor is VAT‑registered; many vendors won’t charge VAT. Platform fee applies to vendor payout calculation and is always shown to vendor.

**Next Steps:**
- Implement Property→Dedicated Vendors management UI with RLS‑safe queries or SECURITY DEFINER RPCs for list/mutate.
- Hook contract activation/termination to toggle `dedicated_vendors.is_active`.
- Owner New Request form: add “Invite my dedicated vendors” toggle and category scoping.
- Extend vendor contract detail UI to show PO/Execution/Closure sections with VAT/platform fee math.

---

## [2025-08-16] – Fetch Performance Optimizations (Vendor Jobs, Owner Maintenance)
**Status:** Completed  
**Description:** Reduced perceived data loading lag by parallelizing independent Supabase calls and batching per-row counts into a single query. Maintains DB-first/RLS-safe hydration (no embedded joins across RLS tables) and minimizes selected columns.

**Changes:**
- Vendor Jobs (`src/app/dashboard/vendor/jobs/page.tsx`)
  - Parallelized queries for: `service_contracts`, `purchase_orders`, `job_executions`, `quotes`, and `vendor_quote_requests` using `Promise.all`.
  - Parallelized the two `maintenance_requests` queries (invited vs selected_vendor) and merged results client-side.
  - Kept selects to essential columns only.

- Owner Maintenance List (`src/app/dashboard/owner/maintenance/page.tsx`)
  - Replaced N per-request quote count calls with one batched select of `quotes` by `request_id`; built a count map and merged counts locally.
  - Preserved base-then-hydrate pattern to avoid RLS recursion issues.

**Impact:**
- Fewer network round trips, reduced sequential latency on initial load, smoother UI on both pages.

**Guidelines (applied and to keep):**
- Use `Promise.all` for independent fetches; only request needed columns.
- Avoid embedded joins across RLS-protected tables; hydrate in separate calls or via SECURITY DEFINER RPCs when needed.
- Batch aggregations (counts/sums) to a single grouped call or map from a single select.

**Next Targets:**
- Review other pages for similar batching opportunities and apply the same pattern.

---

## [2025-08-16] – Owner Dashboard: My Vendors Quick Action + Live Data Wiring
**Status:** Completed  
**Description:** Preserved the original Owner dashboard layout, added a compact "My Vendors" quick action, and removed static mocks in favor of optimized live queries.

**Changes:**
- `src/app/dashboard/owner/page.tsx`
  - Added a small quick action card "My Vendors" linking to `/dashboard/owner/dedicated-vendors` placed above "Active Maintenance" and also added to the Portfolio Summary action row.
  - Replaced mock stats with batched/parallel Supabase queries:
    - Portfolio metrics: properties → active leases (occupied), payments this month (income)
    - Documents counts: leases, purchase orders for owner service contracts, quotes on owner requests
    - Active Maintenance: recent owner maintenance requests
    - Recent Activity: latest maintenance audit events
  - All selects are column-scoped; independent queries parallelized with `Promise.all`.

**Impact:**
- Dashboard now reflects seeded data dynamically without removing any section, and loads faster due to fewer sequential calls.

---

## [2025-08-16] – Dedicated Vendors Page: Two Expandable Sections (All + Filtered Manage)
**Status:** Completed  
**Description:** Implemented owner-friendly management with a top aggregate view and a lower filtered/manage section.

**Changes:**
- `src/app/dashboard/owner/dedicated-vendors/page.tsx`
  - New top section "All Dedicated Vendors" (default open) aggregating across all owner properties; batched hydration for vendors/properties/categories; actions: toggle Active, Remove.
  - Existing property/category filtered section retained below with Add Vendor (by ID), priority, Active/Remove.
  - Optimized with minimal column selects and `Promise.all`; RLS-safe (no embedded joins across protected tables).

**Impact:**
- Single page shows the full roster and precise per-property/category management, reducing navigation and improving clarity.

---

## [2025-08-16] – RLS-safe Vendor Search + Duplicate Prevention (Email Unique, Contact Required)
**Status:** Completed (UI + RPC) / Partially Applied (DB)  
**Description:** Owner/vendor search uses SECURITY DEFINER RPC to bypass RLS safely. Prevent duplicates via email unique (partial) and a trigger enforcing at least one contact (email or phone). Deferred phone uniqueness due to demo phones being reused.

**Changes:**
- DB:
  - RPC `public.search_vendors_minimal(p_term text, p_limit int)` added (SECURITY DEFINER).
  - Partial unique index on `lower(email)` where `email is not null`.
  - Trigger `trg_vendor_contact` to ensure vendors always have email or phone.
  - Deferred: phone unique index until demo numbers are cleaned.
- UI:
  - `src/app/dashboard/owner/maintenance/new/page.tsx`: Invite Vendors uses RPC search; click result to add invite.
  - `src/app/dashboard/owner/dedicated-vendors/page.tsx`: Search via RPC; click Add to insert into `dedicated_vendors` with priority.

**Impact:**
- Search works for owners under RLS; future vendor duplicates by email are blocked; vendors must have at least one contact method.

**Next:**
- Add phone normalization and unique index post demo-data cleanup.

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
