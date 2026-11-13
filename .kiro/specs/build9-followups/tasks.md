# Tasks — Build 9 Follow-ups

> Open items after build 9 (2026-11-13). Work top to bottom: one branch → PR →
> merge → test on iOS sim + Android emulator after each merge.
> Severity: 🔴 blocker · 🟠 major · 🟡 minor · ⚪ nit
> Status: ⬜ todo · 🔄 in progress · ✅ done (merged + tested)

---

## B9-000 🔴 Merge the build-9 branch into main ✅

- **Why:** every later task branches from `main`; today's fixes (lease send,
  maintenance RLS recursion, inspection signatures, sign-in flash…) live only on
  `feat/lifecycle-inspection-issues-deposit-confirm`.
- **Acceptance criteria:**
  - [x] PR #219 opened from the feature branch to `main` with the build-9 summary.
  - [x] CI: TypeScript green; Lint + Tests red on main already (see B9-009).
  - [x] Merged 2026-11-13; post-merge: tab-bar guard passes on iOS + Android,
        Android smoke flow (release APK built from main) passes.

## B9-001 🟠 Finish lifecycle stage 06 (inspection) on device ✅

- **Where it stopped:** after the tenant raises an inspection comment as a
  maintenance request, the flow could not find `inspection-export` (PDF export).
- **Found while testing (fixed on this branch):**
  - Inspection photos were saved as `file://` paths on the inspector's phone —
    never uploaded, so the other party and the PDF never saw them. Now resized
    (shared `src/shared/utils/photoUpload.ts`) and uploaded to
    `inspection-photos/{inspection_id}/`.
  - With the keyboard up, the first tap on "Add Comment" only closed the
    keyboard — tenant comments silently weren't posted.
- **Owner request (2026-11-13):** the PDF must be the complete report from the
  client template (`docs/106 - Flats Cerise … Move In Inspection … FULL.pdf`).
- **Acceptance criteria:**
  - [x] `lifecycle-06-inspection.yaml` passes end to end on a fresh inspection
        (schedule → rooms/photos → complete → owner + tenant sign → completed);
        all 11 photos stored as uploaded URLs (~85 KB each).
  - [x] Inspection PDF export works for both roles.
  - [x] PDF follows the template: cover photo + address + date + prepared by,
        contents, actions required (+ photos), areas with Ref x.y tables and
        photo grids, keys, declaration, signature images, appendix (comment
        summary + status overview). Item rows show the recorded condition —
        the app does not capture Clean/Undamaged/Working answers.
  - [x] F10 (inspection statuses `pending_signatures` → `completed`) confirmed
        on device.

## B9-002 🟠 Run lifecycle 07 → 08 on build 9 and fix what breaks ⬜

- **Scope:** 07 issue → maintenance, 07b vendor quote, 07c Send PO
  (**F12 date fix, still unverified on device**), 07d work closure +
  verification, 08 occupied.
- **Note:** maintenance-request UPDATE was failing for every role until
  migration `20261113000008`; 07–08 have not run since.
- **Acceptance criteria:**
  - [ ] 07, 07b, 07c, 07d, 08 pass on the iOS simulator.
  - [ ] F12: Send PO accepts today's date and stores the local date.
  - [ ] Vendor flows confirmed still allowed by the tightened
        maintenance_requests UPDATE policy.

## B9-003 🟠 Inspection photo markup (draw on a photo to show the issue) ⬜

- **Request (owner, 2026-11-13):** "editing on image to show the issues on
  location".
- **Today:** rooms/items take photos (camera/gallery); no way to mark them up.
- **Approach:** reuse `react-native-signature-canvas` (already installed,
  WebView-based → no native rebuild) with the photo as background; red
  pen + undo + clear; save the flattened image as the inspection photo.
- **Acceptance criteria:**
  - [ ] Every inspection photo has "Mark up"; drawing is saved with the photo.
  - [ ] Owner and tenant both see the marked-up photo (and in the PDF).
  - [ ] Works on iOS and Android; Maestro flow covers open → draw → save.

## B9-004 🟡 Inspection photos are uploaded full size ✅ (done in B9-001)

- `InspectionScreen.pickImage` / camera use `quality: 0.8` with no resize —
  same slow-loading problem listings had.
- **Acceptance criteria:**
  - [ ] Inspection (and maintenance) photos go through the same 1280 px JPEG
        resize as listing photos (`prepareListingPhoto` → shared helper).

## B9-005 🟡 Remaining `toISOString().split('T')[0]` date formatting ⬜

- Wrong calendar day between 00:00 and 02:00 SAST. Replace with the local
  `toDateString()` helper (`src/shared/components/ui/DateField.tsx`) where the
  value is a calendar date:
  - `src/features/tenant/screens/TenantLeaseScreen.tsx`
  - `src/features/tenant/screens/TenantArrearsScreen.tsx`
  - `src/features/payments/api/paymentDisputes.api.ts`
  - `src/features/owner/screens/AddPropertyScreen.tsx`
  - `src/features/owner/screens/OwnerLeaseDetailScreen.tsx`
  - `src/features/owner/screens/OwnerInsuranceClaimScreen.tsx`
  - `src/features/owner/screens/OwnerLeaseRenewalScreen.tsx`
  - `src/features/owner/screens/EditPropertyScreen.tsx`
  - `src/features/tax/screens/OwnerPropertyTaxScreen.tsx`
  - `src/features/leases/utils/leaseDateMath.ts`
  - `src/features/leases/api/leasePdfService.ts`
  - `src/features/leases/api/leaseRenewal.api.ts`
  - `src/features/properties/api/viewingReminders.ts`
  - `src/features/maintenance/api/maintenanceApi.ts`
  - `src/features/maintenance/api/invoices/invoices.api.ts`
  - `src/features/maintenance/api/quotes/quoteActions.api.ts`
  - `src/features/maintenance/api/quotesApi.ts`
  - `src/features/maintenance/api/work/workProgress.api.ts`
  - `src/features/maintenance/api/work/workExecution.api.ts`
- **Acceptance criteria:**
  - [ ] Calendar dates use local formatting; true timestamps keep ISO.
  - [ ] Unit test pins a 01:00 SAST case.

## B9-006 🟡 Long / complex screens — better presentation ⬜ (blocked)

- **Request (owner):** use UI/UX libraries and elements from the Twitter-intel
  bookmarks to present long screens better (inspection, lease create,
  application, PO).
- **Blocked:** intel router `http://100.79.34.78:8000` — `/v1/intel/search`
  and `public-ask` return `embedding_failed` ("cannot query brain"). Fix the
  embedding service, then pull the bookmarked libraries before designing.
- **Acceptance criteria:**
  - [ ] Bookmarked candidates listed and one chosen per pattern
        (collapsible sections, sticky step header, bottom sheets).
  - [ ] Applied to the inspection and lease-create screens first.

## B9-007 🟡 Dashboard load time ⬜

- Build 9 removed the double profile fetch and the sign-in bounce. Still to do:
  measure cold-start → dashboard time on Android release and fix the slowest
  calls (dashboard fires several sequential queries).
- **Acceptance criteria:**
  - [ ] Before/after timing recorded for owner and tenant on the release APK.
  - [ ] Dashboard renders cached/skeleton content immediately.

## B9-008 ⚪ Test-data follow-ups ⬜

- Test lease `23d25ca6…`: first payment stored as 2026-11-30 (pre-fix; due_date
  is immutable) and its PDF was generated before the escalation fix — tap
  "Regenerate PDF" and reset the lifecycle fixture before the next full chain.
- **Acceptance criteria:**
  - [ ] A reset script (or migration-free admin steps) recreates the lifecycle
        fixture so the chain can run from 01 cleanly.

## B9-009 🟠 CI is red on main (Lint + Tests) ⬜

- **Lint:** CI's ESLint 9 can't load the `expo` shareable config
  ("ESLint couldn't find the config \"expo\"") and runs `--max-warnings 0`
  against ~4.4k existing warnings — fails before checking anything.
- **Tests:** 5 suites fail to run (Jest transform can't parse an imported
  module): documentsApi, leasePdfService, OwnerLeaseReviewScreen, poActions,
  leaseSignGate. Already failing on PRs #209/#210 before build 9.
- **Acceptance criteria:**
  - [ ] Lint job loads the config and gates on errors (warnings budget agreed).
  - [ ] The 5 suites run; Tests job green.
