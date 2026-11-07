# Tasks — Client Test Build 7

> Issues captured live during the 2026-11-07 three-phone client session.
> Severity: 🔴 blocker · 🟠 major · 🟡 minor · ⚪ nit

---

## CT7-001 🟠 Sign-up should not require document uploads

- **Role:** all roles (surfaced on owner sign-up)
- **Screen / flow:** Sign-up → "Documents" step (ID, proof of address, etc.)
- **Problem:** Sign-up currently asks for documents up-front. Client wants
  sign-up to be **frictionless** — email + password + name only. Documents
  should be deferred to a later step (profile completion, KYC prompt, or when
  the user first tries to perform an action that legally requires them).
- **Acceptance criteria:**
  - [ ] Sign-up flow asks for the minimum needed to create the account
        (name, email, password, role).
  - [ ] No document-upload gate blocks reaching the dashboard.
  - [ ] Document upload remains available from Profile → Documents (or a
        "Complete your KYC" banner on the dashboard).
  - [ ] FICA/POPIA legal copy stays, but is enforced at the point the user
        tries to lease / list a property, not at sign-up.
- **Suggested fix path:**
  - Audit `app/(auth)/sign-up*` + `src/screens/auth/*` for any required
    `document_*` fields — move them out of the required path.
  - Keep the `profiles.kyc_status` field; set it to `pending` on sign-up so
    the existing compliance screens still show the gap.
  - Add a dismissible dashboard banner "Finish your KYC" linking to the
    existing Documents screen.

## CT7-002 🟡 Cold-start / dashboard load is sluggish

- **Role:** owner (confirmed), likely tenant + vendor too
- **Screen / flow:** App launch → first dashboard paint
- **Problem:** Noticeable delay between tapping the app icon and the dashboard
  being interactive. Client flagged this as perceptible lag.
- **Acceptance criteria:**
  - [ ] Measured cold-start time on a mid-tier Android (Pixel 6 class) is
        under 3s to first dashboard paint.
  - [ ] First meaningful paint shows a skeleton loader within 500ms — no
        blank screen.
  - [ ] Dashboard data fetches run in parallel (not serial awaits).
- **Suggested fix path:**
  - Profile with `npx react-native profile-hermes` on a release build.
  - Check `app/_layout.tsx` + role dashboard screens for serial `await`s on
    Supabase calls — replace with `Promise.all`.
  - Confirm Hermes is enabled in release (it is, per BUILD_INFO) — rule out
    bundle-size regression.
  - Add a lightweight dashboard skeleton (we already have `SkeletonLoader`
    in `src/components/ui/`) so perceived latency drops even if cold-start
    time doesn't change.
  - Consider splash-screen timing — `expo-splash-screen` may be hiding too
    early, causing the blank frame.

## CT7-003 🟡 "Update Property" button should sit at the top of the edit screen

- **Role:** owner
- **Screen / flow:** Owner → Property → Edit Property
- **Problem:** The "Update Property" CTA is at the bottom of a long scroll.
  On a property with many fields + photos the owner has to scroll all the
  way down to save. Client wants it fixed/sticky at the top (header-right)
  or duplicated.
- **Acceptance criteria:**
  - [ ] "Update" / "Save" action is reachable without scrolling — either
        pinned in the screen header (right side) or sticky at the top of
        the form.
  - [ ] Existing bottom button can stay or go — pick one, don't duplicate
        confusingly.
  - [ ] Disabled state when nothing has changed; enabled only on dirty.
- **Suggested fix path:**
  - `app/(owner)/properties/[id]/edit.tsx` (or equivalent) — replace the
    bottom `PrimaryButton` with a Stack.Screen `headerRight` action.
  - Wire form dirty-state to the header button's disabled prop.

## CT7-004 ✅ Photo upload fails with "Network request failed" — FIXED

- **Role:** owner
- **Screen / flow:** Owner → Property → Edit → Add Photo
- **Symptom:** "Network request failed" error on upload.
- **Root cause (diagnosed):** `src/features/properties/api/propertiesApi.ts`
  lines 683–685 uses the broken RN pattern:
  ```ts
  const response = await fetch(file.uri);
  fileBlob = await response.blob();
  ```
  On React Native + Hermes, `response.blob()` on a `file://` URI returns a
  Blob with **size 0 / unreadable stream**. Supabase SDK then POSTs an empty
  body → network layer throws "Network request failed". This is a well-known
  RN gotcha, not a Supabase Storage policy issue.
- **Acceptance criteria:**
  - [ ] Owner can pick an image from library and have it appear in the
        property's photo list within 3s.
  - [ ] Error path shows a clear toast ("Upload failed — retry") not a
        silent swallow.
  - [ ] Works on both new-property and edit-existing-property flows.
  - [ ] Fix is applied consistently across ALL uploaders using the same
        broken pattern.
- **Fix (recommended — ArrayBuffer via base64):**

  ```ts
  import * as FileSystem from 'expo-file-system';
  import { decode } from 'base64-arraybuffer';

  const base64 = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const arrayBuffer = decode(base64);

  await supabase.storage
    .from(STORAGE_BUCKETS.PROPERTY_IMAGES)
    .upload(fileName, arrayBuffer, { contentType: file.type });
  ```

  (`base64-arraybuffer` is tiny — 1kb — and Supabase JS v2 accepts
  `ArrayBuffer` natively.)

- **Fix applied:** `src/features/properties/api/propertiesApi.ts`
  - Added `expo-file-system/legacy` + `base64-arraybuffer` imports.
  - Replaced the broken `fetch(uri).blob()` branch with the
    `readAsStringAsync` → `decode` → `ArrayBuffer` path.
  - Passed `arrayBuffer` to `supabase.storage.upload()`.
  - Type-check: clean (0 errors).
- **Audit result (checked all 6 sibling uploaders):**
  - ✅ `tenant/screens/TenantProfileScreen.tsx` — already using arrayBuffer
  - ✅ `leases/api/storageService.ts` — already using arrayBuffer
  - ✅ `maintenance/hooks/useMediaUpload.ts` — already using arrayBuffer
  - ✅ `documents/api/documentsApi.ts` — already using arrayBuffer
  - ✅ `vendor/api/profileApi.ts` — already using arrayBuffer
  - ✅ `src/lib/storage.ts` — shared `uploadFile()` helper exists and is correct
    → `propertiesApi.ts` was the only remaining regression. No further
    refactor needed this session; a future cleanup could migrate it to use
    the shared `uploadFile()` helper for consistency.
- **Verification steps for Navin on next build:**
  - [ ] Owner → edit property → Add Photo → pick from library → photo appears
  - [ ] Try PNG + JPEG + HEIC
  - [ ] Try on both new-property creation and existing-property edit

## CT7-005 ✅ Address search dropdown overlaps the input — FIXED

- **Role:** owner
- **Screen / flow:** Owner → Add/Edit Property → Property Location picker
- **Problem:** The Google Places autocomplete suggestion list was flowing
  **inline** (no absolute positioning), so when results showed they pushed
  the "Selected" box + map down AND the list visually sat on top of the
  input, making it unusable.
- **Root cause:** `styles.autocompleteList` had no `position: 'absolute'`
  and the container had `zIndex: 1`.
- **Fix applied:** `src/features/owner/components/LocationPicker.tsx`
  - `autocompleteList` → `position: absolute`, `top: 50`, `left/right: 0`,
    `maxHeight: 260`, `zIndex: 9999`, `elevation: 10`, drop-shadow.
  - `autocompleteContainer` → `zIndex: 9999`, `elevation: 10`.
  - Added `autocompleteRow` + `autocompleteSeparator` so each suggestion
    renders with proper padding/divider instead of the default raw list.
  - Fixed input `height: 46` so the floating list's `top: 50` is stable.

## CT7-006 ✅ Google Places search returns nothing — FIXED

- **Role:** owner
- **Screen / flow:** Owner → Add/Edit Property → Property Location search
- **Problem:** Typing in the address field never shows results — looks like
  "Google search isn't working".
- **Root cause:** `<GooglePlacesAutocomplete listViewDisplayed={false} ... />`
  on `LocationPicker.tsx:154` **hard-hid** the result dropdown. The query
  was firing and results were returning — the user just couldn't see them.
- **Fix applied:** removed the `listViewDisplayed={false}` prop. Defaults
  back to `'auto'` so the list shows while the input is focused with results,
  hides otherwise.
- **API key verified:** `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is wired in
  `.env` + `app.config.js` → read via `Constants.expoConfig.extra.googleMapsApiKey`.
  Country restricted to `za` (South Africa) as intended.
- **Verification steps for Navin on next build:**
  - [ ] Type a street name → dropdown appears below input with SA results
  - [ ] Tap a result → map pin jumps, "Selected" card fills in
  - [ ] Dropdown does NOT visually overlap the input text
  - [ ] Dropdown floats OVER the map/selected card, not pushing them down

## CT7-007 ✅ Samsung Pass pops up on every text box — FIXED

- **Role:** all roles (surfaced on owner — Samsung phone)
- **Screen / flow:** any screen with an input (property form, maintenance,
  search, etc.)
- **Problem:** Tapping any text box triggers Samsung Pass prompt. Jarring
  on non-auth fields (address line, description, numbers, etc.).
- **Diagnosis:**
  - Samsung Pass is a phone-level autofill service — can't disable from
    our side as a whole, but we CAN tell each field not to opt in.
  - On Android, React Native's `TextInput` uses `autoComplete` /
    `importantForAutofill` to tell the OS the field's semantics. When we
    leave them unset, Android guesses and Samsung Pass pops on anything it
    thinks might be a credential-ish field.
  - Audit showed only 3 fields in the app explicitly declare autofill:
    `LoginScreen` (email + password), `RegisterScreen` (email) — those
    SHOULD trigger Samsung Pass (correct UX). Every other field uses the
    shared `<Input>` component, which had no autofill hint, so Samsung
    Pass was triggering on everything.
- **Fix applied:** `src/shared/components/ui/Input.tsx`
  - Default `autoComplete="off"` + `importantForAutofill="no"` +
    `textContentType="none"` + `autoCorrect={false}`.
  - Placed BEFORE `{...props}` so any screen that wants to opt in (future
    needs — profile email, phone number for OTP, etc.) can still pass an
    explicit prop that overrides the default.
  - Auth screens unchanged: they use raw `TextInput`, not the shared
    `Input`, and still get Samsung Pass as expected.
- **What Navin will see:**
  - Tap address, description, amount, search → no more Samsung Pass prompt
  - Tap email on Login/Register → Samsung Pass still offers to fill
    (as it should)

## CT7-008 ✅ "Available From" needs a date picker — FIXED

- **Role:** owner
- **Screen / flow:** Owner → Add Property → Lease Terms → Available From
- **Problem:** Field was a plain text input with placeholder `YYYY-MM-DD`,
  forcing owners to type the date by hand — error-prone + bad UX.
- **Fix applied:** `src/features/owner/screens/AddPropertyScreen.tsx`
  - Replaced `TextInput` with a `TouchableOpacity` that opens
    `@react-native-community/datetimepicker` (already in deps, same pattern
    used by `TenantRequestViewingScreen` + `OwnerViewingDetailScreen`).
  - `minimumDate={new Date()}` — can't pick a date in the past.
  - Writes back as `YYYY-MM-DD` ISO date string (schema unchanged).
  - iOS: spinner display, Android: default native dialog.
- **Follow-up (not in this PR):** `EditPropertyScreen` has the same
  text-input field — same fix would be ~15 LoC; deferring until Navin
  confirms the Add-screen UX feels right.

## CT7-009 ✅ "Allow deleting photos while adding/editing property" — FIXED

- **Role:** owner
- **Screen / flow:** Owner → Add Property + Edit Property → photo strip
- **Problem (perceived):** Client said delete was missing.
- **Problem (actual):** A `×` button was already rendered on each photo
  via `removePhoto(index)` — but it was 24×24 at `top:-8, right:-8`, i.e.
  partly OFF the photo frame, below the 44pt touch target, and easy to
  miss on a thumbnail.
- **Fix applied:**
  `src/features/owner/screens/AddPropertyScreen.styles.ts`
  `src/features/owner/screens/EditPropertyScreen.styles.ts`
  - Button is now 32×32 at `top:2, right:2` — fully inside the photo,
    above the touch-target floor.
  - 2px white border + drop-shadow so it reads against any photo colour.
  - `×` text size bumped to 18 + explicit `lineHeight: 20` for Android
    vertical centering.
  - `photoContainer` gets `padding: 6` so the button has breathing room
    when the parent View clips.
- **Both screens:** delete logic was already correct; no JS changes
  needed — only styling. On Edit, remote photos removed from the array
  are persisted-out on save (handleSubmit filters remote vs local and
  writes the combined final list back to `properties.images`).

## CT7-010 ✅ Cancel on Edit Property returns to tab root instead of previous screen — FIXED

- **Role:** owner
- **Screen / flow:** Owner → Property Detail → Edit → tap Cancel (or back arrow)
- **Problem:** Cancelling the edit took the user all the way back to the
  Properties list (tab root). Expected: return to the Property Detail
  screen they came from.
- **Root cause:** `EditPropertyScreen.tsx:72` was hard-coded to
  `router.navigate('/(owner)/properties')` to work around an old bug where
  `router.back()` from a hidden-tab route (`properties/[id]/edit` has
  `href:null`) would pop past the tab stack and land on the Dashboard.
  The workaround was too aggressive — it also killed the legitimate
  back-one-step case.
- **Fix applied:** `src/features/owner/screens/EditPropertyScreen.tsx`
  - `goBackToProperties()` now uses `router.canGoBack()` to prefer
    `router.back()` when there IS a screen to return to, and only falls
    back to the Properties tab for cold-start / deep-link entries.
  - All four call sites (back arrow, Cancel, post-save Alert OK button,
    post-save direct navigation) share the same helper — no duplication.
- **Side benefit:** post-save flow now also returns to Property Detail if
  that's where the user came from, which is probably what Navin wants
  anyway (see the newly-saved changes reflected on the detail screen
  without manually navigating back in).

## CT7-011 ✅ "Failed to create property" shown but property appears on Rent Roll — FIXED

- **Role:** owner
- **Screen / flow:** Owner → Add Property → tap Create
- **Problem:** Navin reported that property creation showed a "Failed"
  error BUT the property still appeared on the Rent Roll afterwards.
- **Root cause:** `handleSubmit` wrapped BOTH `createProperty()` AND
  `uploadPropertyPhotos()` in one try/catch. The property row was
  inserted successfully (DB commit landed → shows up on Rent Roll), then
  the photo upload threw "Network request failed" (the CT7-004 bug which
  shipped in build.7). The outer catch reported "Failed to create
  property", misleading the user into thinking the whole operation
  failed. Classic cascade-failure masquerading as the wrong error.
- **Downstream effect:** Even once CT7-004 is deployed and photos upload
  reliably, ANY future post-create step (email notification, geocoding,
  indexing) could repeat this misdiagnosis.
- **Fix applied:** `src/features/owner/screens/AddPropertyScreen.tsx`
  handleSubmit split into two separately-reported stages:
  - **Stage 1 — createProperty:** if this throws, nothing was committed,
    show the real error, user retries the form.
  - **Stage 2 — uploadPropertyPhotos:** property is already live at this
    point. If upload throws, show a WARNING: _"Property created, photos
    pending — retry from Edit Property"_ instead of a blanket failure.
  - Different haptic (`Warning` vs `Success`) so the user feels the
    partial-success state.
- **Why this is a permanent fix, not just a band-aid for CT7-004:**
  it decouples the UX contract from any specific post-create step. New
  post-create work can be added in its own try block with the same
  pattern — report success for what succeeded, warn for what didn't,
  never roll the whole thing into one misleading "Error".

## CT7-012 🟠 Lease signing should be blocked until tenant profile is complete

- **Role:** tenant
- **Screen / flow:** Tenant → Lease → tap Sign Lease
- **Problem:** Currently any authenticated tenant can open the signature
  modal from `TenantLeaseScreen.handleSignLease` with no profile gate.
  FICA + RHA require verified identity, DOB, address and contact before
  a lease is binding.
- **Suggested fix path:**
  - Build `src/features/tenant/utils/profileCompleteness.ts` as the
    ONE source of truth for "is this tenant allowed to lease?". It
    should merge the `profiles` column view and the legacy
    `fica_documents` JSON view, returning `{ complete, missing[] }`.
  - Required fields: `full_name`, `phone`, SA `id_number`, `date_of_birth`,
    `monthly_income`, `proof_of_address_url`.
  - Gate `handleSignLease` in `TenantLeaseScreen.tsx` on a call to
    that util. On incomplete, Alert → route to `/(tenant)/profile`.
  - **Must share the util with CT7-013** so banner + gate can't drift.
- **Acceptance criteria:**
  - [ ] Tenant with all required fields can tap Sign Lease and see the
        signature modal immediately.
  - [ ] Tenant with any missing field sees an Alert listing exactly
        which fields are missing + a "Go to Profile" button.
  - [ ] No code-path duplication: dashboard banner (CT7-013) and lease
        gate read from the same util.

## CT7-013 🟠 "Complete your profile" banner persists after profile is saved

- **Role:** tenant
- **Screen / flow:** Tenant → Profile → fill fields → Save → return to
  Dashboard → banner still shown
- **Diagnosis (two overlapping bugs — one fix solves both):**
  1. **Semantic drift.** The dashboard banner at
     `TenantDashboardScreen.tsx:547-578` checks `id_number`,
     `monthly_income`, `proof_of_address_url` but labels the three rows
     "Identity Verification", "Proof of Income", **"References"**.
     The "References" row is actually checking Proof of Address, so
     Navin sees "References" as missing even after uploading proof of
     address — confusing + misleading.
  2. **Two sources of truth.** Dashboard's completeness check is
     inline + different from any future gate. If the Profile screen's
     Save path writes to `profiles.id_number` but the dashboard reads
     `fica_documents.id_number` (or vice versa) for a given account,
     the banner never dismisses regardless of what the tenant does.
     `useFocusEffect` IS wired on the dashboard, so the refresh timing
     is fine — this is a data-path mismatch, not a caching issue.
- **Suggested fix path:**
  - Build the shared `profileCompleteness.ts` util (same one as CT7-012).
  - Replace the hard-coded `verificationStatus` state + banner JSX with
    `profileMissing: string[]`. Banner lists the REAL missing fields
    from the util, and the CTA routes to `/(tenant)/profile` (not
    `/(tenant)/documents`, which is a dead-end for these fields).
  - Hide the banner while `profileMissing === undefined` so it doesn't
    flash on first render before the async check lands.
- **Acceptance criteria:**
  - [ ] Banner lists the actual missing fields (no more fake "References"
        when Proof of Address is what's missing).
  - [ ] Saving the Profile screen → back to Dashboard → banner is gone
        within one focus cycle.
  - [ ] Zero banner flash on first dashboard paint.
  - [ ] Banner CTA routes to Profile, not Documents.
- **Bundle with CT7-012:** both issues share the same util. Do them
  together in one PR so the shared file doesn't land twice.

## CT7-014 🟠 Tenant profile must capture SA ID document + Salary Certificate uploads

- **Role:** tenant
- **Screen / flow:** Tenant → Profile
- **Problem:** Current Profile screen captures the SA ID _number_ and
  the _amount_ of monthly income — but NOT the actual document uploads
  that FICA / landlord diligence require. Owners need to see:
  - **SA ID document** (front + back photo, or ID card scan) — so the
    landlord can verify the ID number against a real document.
  - **Salary certificate / payslip** (last 3 months typical) — proof
    that the stated monthly income is real.
- **Current state (verified):**
  - `TenantProfileScreen.tsx` has inputs for: `full_name`, `phone`,
    `id_number`, `date_of_birth`, `monthly_income`, and one existing
    upload field: `proof_of_address_url`.
  - No uploader for the ID document itself.
  - No uploader for salary certificate / payslips.
- **Suggested fix path:**
  - DB: add two columns to `profiles` (or extend the existing
    `fica_documents` JSON): `id_document_url: text`, `salary_certificate_urls: text[]`.
    Use text[] for salary so the tenant can submit multiple payslips
    (typically 3 months).
  - Storage: reuse the existing `tenant-documents` bucket (or whichever
    FICA bucket we standardised on in CT7-004's audit) — it already
    exists and the RLS allows authenticated insert for own folder.
  - UI on `TenantProfileScreen.tsx`:
    - "SA ID Document" row with Upload button + preview thumbnail +
      Replace action. Single file.
    - "Salary Certificate / Payslips" row with Upload button + list of
      uploaded files + per-file delete (reuse the CT7-009 photo-delete
      pattern we just built).
  - Both uploaders use the shared `src/lib/storage.ts` `uploadFile()`
    helper (base64 → ArrayBuffer path — the only path that works on RN).
  - Add both fields to `profileCompleteness.ts` (CT7-012 / CT7-013
    shared util) so the lease-sign gate and dashboard banner both
    enforce them.
- **POPIA note:** both documents are personal identifiers — document
  access on the owner side must be gated behind the "ID & Income"
  tenant-approved disclosure flow (we already have the pattern in
  `src/features/compliance/`). Don't just paste the URL into the
  owner's applications view.
- **Acceptance criteria:**
  - [ ] Tenant Profile shows two new upload sections: SA ID doc +
        Salary Certificate(s).
  - [ ] Both persist to Supabase Storage via the shared uploadFile()
        helper (no \`fetch().blob()\` regression).
  - [ ] Owner can view them from the rental-application detail screen
        with POPIA disclosure gating.
  - [ ] Profile is NOT considered complete (for CT7-012 / CT7-013) until
        both docs are uploaded.

---

## Captured, not yet triaged

<!-- Drop new issues here as they come in; I'll move them above once categorized -->

## CT7-015 🟠 Owner should confirm whether the viewing happened on its date

- **Role:** owner + tenant (parity)
- **Screen / flow:** Owner → Viewings → viewing on its scheduled date passes →
  owner should see a "Did the viewing take place?" prompt
- **Problem (client's words):** _"Once the property is viewed on its appointed
  date and time, owner should be asked yes or no property viewed or not.
  If owner says yes, the request viewing on tenant should disappear and
  only apply should remain."_
- **Expected flow:**
  1. Scheduled viewing passes its start time (owner has accepted, tenant
     has confirmed, calendar event is in the past).
  2. Owner dashboard / viewings list surfaces a "Confirm viewing" card:
     Did [Tenant] view [Property] on [date]? → Yes | No.
  3. On **Yes** — viewing is marked `viewed`. Tenant's "Request viewing"
     CTA on the property detail disappears; only the Apply CTA remains.
  4. On **No** — viewing stays in a `no_show` state the owner can then
     reschedule or cancel from.
- **Suggested fix path:**
  - DB: add a `viewed_at: timestamp` + `viewing_outcome: enum('viewed',
'no_show', 'pending_confirmation')` to `viewing_requests` (or extend
    the existing `status` enum — need to check the schema).
  - Server: a cron / trigger moves `confirmed` viewings whose
    `scheduled_at + duration < now()` into `pending_confirmation`. Could
    also compute this on read, no cron needed.
  - Owner UI: new confirmation card on OwnerViewingsScreen / dashboard.
    Yes → updates row + tenant's view of the property changes.
  - Tenant UI: `TenantPropertyDetailScreen.renderCTA()` hides the
    "Request Viewing" button when the tenant has a `viewed` viewing on
    that property.
- **Acceptance criteria:**
  - [ ] Owner sees a confirmation prompt the day after a scheduled viewing.
  - [ ] Yes → viewing marked viewed; tenant can only Apply from that
        property's detail page.
  - [ ] No → viewing marked no_show; owner can reschedule or cancel.
  - [ ] Owner and tenant never disagree on whether a viewing happened.
  - [ ] Idempotent — if the owner confirms twice the state doesn't flip.

## CT7-016 🟠 Rental application should pre-fill from tenant profile

- **Role:** tenant
- **Screen / flow:** Tenant → Property → Apply for rental
- **Problem (client's words):** _"While applying for property app asks lot
  of questions. These questions should be in profile as well. And should
  be in application already if tenant has filled in already in profile.
  If not then ask those questions."_
- **Expected flow:**
  - Application form loads → fields that already exist on the tenant
    profile are pre-filled and read-only (or editable but pre-filled).
  - Only genuinely application-specific fields (desired move-in date,
    preferred lease length, "why this property") are asked fresh.
  - Fields that are missing from profile AND required for the application
    are asked as a smaller form — and the answer is ALSO written back to
    the profile so the next application has them pre-filled.
- **Suggested fix path:**
  - Audit `TenantApplicationScreen` for the full question list, categorize
    each field as:
    - **Profile-derived** — read from `profiles` + `fica_documents` JSON,
      show read-only (or editable with a save-back-to-profile hook).
    - **Application-specific** — ask every time.
    - **Missing-from-profile** — ask once, save to profile on submit.
  - Use the same `checkTenantProfileCompleteness` field list where it
    overlaps so the UX stays consistent with the dashboard banner
    (CT7-013) and the lease-sign gate (CT7-012).
  - Consider a shared `getTenantProfilePrefill(userId)` util that
    returns a typed snapshot used by both the application form and any
    future lease-sign form.
- **Acceptance criteria:**
  - [ ] Tenant with complete profile sees the application form with
        name / email / phone / ID / DOB / employer / income / etc.
        already filled.
  - [ ] Tenant with partial profile sees ONLY the missing fields asked.
  - [ ] Answers to missing fields are written back to the profile on
        successful application submit.
  - [ ] Dashboard banner clears as soon as the application-time
        answers land (same `useFocusEffect` refresh).

## CT7-017 🔴 Owner — "Send Request" on holding deposit throws RLS error

- **Role:** owner
- **Screen / flow:** Owner → Applications → Request Holding Deposit →
  Send Request
- **Problem (client's words):** _"Request holding deposit Send request
  button throws error — failed to create holding deposit — RLS issue."_
- **Diagnosis path:**
  - Error text "failed to create holding deposit" comes from
    `holdingDepositApi.create*` — need to find the INSERT call.
  - Supabase RLS on `holding_deposits` table rejects the insert.
  - Candidate causes:
    1. Policy requires `owner_id = auth.uid()` but the INSERT doesn't
       send owner_id (or sends a different field).
    2. RLS reads via `applications.owner_id` join but the application
       row's owner_id doesn't match the signed-in user (data mis-link).
    3. No INSERT policy at all on `holding_deposits` — only SELECT /
       UPDATE for owners, so client-side INSERT needs a SECURITY
       DEFINER function.
  - Need to pull the `holding_deposits` table RLS policies from
    `database/migrations/*holding*.sql` and the
    `holdingDepositApi.create()` payload.
- **Suggested fix path:**
  - Grep for `holding_deposits` in migrations to see the policy.
  - Compare `policy (WITH CHECK ...)` expression against the payload
    the API sends.
  - Likely fix: ensure `owner_id = auth.uid()` on the insert payload,
    OR move creation into a SECURITY DEFINER RPC that validates owner
    against the application's property.
- **Acceptance criteria:**
  - [ ] Owner taps Send Request → row appears in `holding_deposits`
        with matching `owner_id` / `tenant_id` / `application_id`.
  - [ ] Tenant gets the "Pay now" CTA on their side.
  - [ ] No bare "failed to create" toast — real error surfaced if the
        policy still rejects.

## CT7-018 🟠 Holding deposit payment lacks distinguishing bank-statement reference

- **Role:** tenant (paying) + owner (reconciling)
- **Screen / flow:** Tenant → Property / Application → Pay holding
  deposit → PayFast / Yoco → bank statement line item
- **Problem (client's words):** _"Holding deposit when being paid by
  tenant, it should have all the details that distinguishes clearly
  what that deposit was for in bank account and should appear in bank
  statement."_
- **Why this matters:** owners receive a terse "LALARENTE PAYFAST" line
  on their bank statement with no indication of WHICH tenant / property /
  deposit. Reconciling between the app's holding-deposits list and the
  actual bank statement becomes manual guesswork — exactly the problem
  a rental platform is supposed to solve.
- **Suggested fix path:**
  - PayFast: the `item_name` + `item_description` + `m_payment_id` fields
    on the Yoco / PayFast payload flow through to the merchant bank
    statement's description line (merchant / acquirer dependent — some
    only surface item_name, some concatenate).
  - Build a deterministic reference:
    `LAL-HD-<application_id_short>-<property_short>`
    e.g. `LAL-HD-A4B2-NASHIN123MAIN` — fits the ~25 char limit most
    acquirers truncate at.
  - Store this reference on the `holding_deposits` row so owner's
    rent-roll / statements screen can show the same string and
    reconciliation becomes a one-grep job.
  - Also pass it into \`item_description\` for the PayFast confirmation
    email the tenant receives — they see exactly what they paid for.
- **Audit scope:**
  - `src/features/payments/vendorPay` / \`payfastHost\` pattern — grep for
    where the payment payload is constructed for holding deposits.
  - Owner statements screen — add the reference column next to the
    deposit row.
- **Acceptance criteria:**
  - [ ] Bank statement line reads something recognisable (contains
        "LAL-HD-" prefix + an identifiable tail) — not just
        "LALARENTE PAYFAST".
  - [ ] The same reference appears on the owner's holding-deposits
        screen next to the row.
  - [ ] Tenant's PayFast confirmation email shows what the deposit
        was for (property + landlord name).
  - [ ] No PII (full ID numbers, phone) in the reference — initials or
        a short hash only.

## CT7-019 🟠 Owner approve-tenancy must be gated on holding deposit paid

- **Role:** owner (surfaced) + tenant (impact)
- **Screen / flow:** Owner → Applications → Approve
- **Problem (client's words):** _"Without holding deposit approve should
  not work for tenancy request approval."_
- **Expected flow:**
  1. Owner reviews a rental application.
  2. Owner requests a holding deposit (CT7-017 covers the current RLS
     failure on that step — this issue assumes CT7-017 lands first).
  3. Tenant pays the holding deposit via PayFast (CT7-018 adds the
     bank-statement reference).
  4. **Only after the deposit is marked paid** can the owner tap
     Approve on the application → lease creation.
  5. Approve button is DISABLED (with explanatory tooltip) until the
     holding deposit status === 'paid'.
- **Suggested fix path:**
  - Audit `OwnerApplicationDetailScreen` approve action for a gate.
  - Join the application to its latest holding_deposits row by
    application_id; disable Approve until that row's status is 'paid'.
  - If the owner chose to SKIP holding deposit (not all landlords want
    one), add an owner-side config / per-application opt-out — but
    default to gated.
  - On tap when still gated, show an Alert: "Request a holding deposit
    first (or waive it) before approving."
- **Depends on:**
  - CT7-017 (holding deposit creation RLS fix).
  - Decision on waivability (ask client — if waivable, the server-side
    rule must still enforce "paid OR waived=true").
- **Acceptance criteria:**
  - [ ] Owner cannot Approve an application that has no holding_deposit
        row in status paid (or waived=true).
  - [ ] Clear UX hint on the approve button explaining why it's gated.
  - [ ] Server-side RLS / policy ALSO enforces this — not just a client
        check.
  - [ ] Tenant never sees "approved" state without having paid a
        deposit first.

## CT7-020 🟠 Owner — lease start/end should use date pickers, not text input

- **Role:** owner
- **Screen / flow:** Owner → Applications → Create Lease → Lease Start Date / Lease End Date
- **Problem (client's words):** _"Date pickers instead of typing the dates for creating lease start and end."_
- **Context — same pattern we already fixed on Add Property:**
  CT7-008 (merged in PR #192) swapped the "Available From" plain
  TextInput for `@react-native-community/datetimepicker`. The lease
  creation screen has the same stale pattern on BOTH date fields.
- **Suggested fix path:**
  - Audit the owner lease-creation screen (likely
    `OwnerLeaseCreateScreen.tsx` or `OwnerApplicationDetailScreen`
    create-lease modal) for the two TextInput date fields.
  - Replace with `TouchableOpacity` → `DateTimePicker` pattern used
    on `AddPropertyScreen.tsx` CT7-008.
  - Start Date: `minimumDate = new Date()` (can't start in the past).
  - End Date: `minimumDate = form.start_date + 1 month` (lease must be
    at least one month — align with the RHA minimum).
  - Both write back as `YYYY-MM-DD` ISO strings to keep the schema
    unchanged.
  - Platform: iOS spinner, Android default dialog — same as CT7-008.
- **Acceptance criteria:**
  - [ ] Both fields open a native picker on tap, no keyboard
  - [ ] Can't pick a start date in the past
  - [ ] End date is at least `start + 1 month`
  - [ ] Lease row saves with the same ISO date strings the typed form
        produced (no schema change)

## CT7-021 🔴 Owner — Lease creation fails

- **Role:** owner
- **Screen / flow:** Owner → Applications → Create Lease → Save
- **Problem (client's words):** _"Lease creation failed."_
- **Open questions — need on next repro:**
  - [ ] The exact error toast text (critical — "Failed to create lease"
        vs a specific DB message)
  - [ ] Does the lease row appear in `leases` even though UI shows
        failure? (parallel of CT7-011 — property-created-but-ui-says-failed)
  - [ ] Does it fail ONLY on certain applications (holding-deposit
        gate from CT7-019?) or every time?
- **Diagnosis path (in order of likelihood):**
  1. **Date fields.** CT7-020 just logged that lease start/end are
     plain TextInput — if the owner left the format wrong (e.g.
     "11/7/26" vs "2026-11-07") the INSERT fails with a date-parse
     error. Fixing CT7-020 would eliminate this class.
  2. **RLS on `leases`.** Same family as CT7-017 — the INSERT policy
     might require `owner_id = auth.uid()` AND `property.owner_id =
auth.uid()`; if either join fails the insert rejects.
  3. **Missing required field.** The `leases` schema has NOT NULL
     columns (deposit, escalation type, payment due day) that the UI
     might not be sending.
  4. **Cascade from CT7-017 / CT7-019.** If the lease depends on a
     holding-deposit row that was never created (RLS failure), the
     foreign-key constraint on `leases.holding_deposit_id` would reject.
- **Suggested fix path:**
  - Pull the exact error text (ask client to screenshot the next time).
  - Grep for `createLease` / `leasesApi.create` in src/features/leases.
  - Compare the INSERT payload against the `leases` RLS policy in
    `database/migrations/*lease*.sql`.
  - Mirror CT7-011 refactor if the UI fails loudly but the row lands —
    split try/catches so error messages are honest.
- **Acceptance criteria:**
  - [ ] Owner can create a lease from an approved application in <5s
  - [ ] Error path shows the real DB message, not a generic "Failed"
  - [ ] Lease row never lands silently while UI reports failure
        (CT7-011 pattern)
- **Blocked by / related:**
  - CT7-020 (date pickers) — eliminates the date-format class of fail
  - CT7-017 (holding deposit RLS) — if lease depends on deposit row
  - CT7-019 (approve-gated-on-deposit) — if lease depends on approve

## CT7-022 🟠 Owner — show + edit lease PDF before sending to tenant

- **Role:** owner
- **Screen / flow:** Owner → Applications → Create Lease → tap Create
- **Problem (client's words):** _"When create lease button is pressed,
  the PDF of lease document should pop up for the owner to read and
  approve or edit. When he clicks on edit, some provision has to be
  provided for them to change the details in texts or clauses of
  agreement. Delete or add clauses or details."_
- **Why this matters:** today the lease is generated server-side with
  a fixed template; the owner sees it only after the tenant signs
  (via the "Download" button on the lease screen). By then it's too
  late to correct a clause. Owners frequently have property-specific
  terms (pet deposits, garden maintenance, tenant-to-pay-for-X) that
  the generic template doesn't cover.
- **Design sketch (two viable phases):**

  **v1 — Review + accept/reject + append (ship fast):**
  - After tapping Create → UI shows a preview screen: PDF rendered
    via `expo-print` from the SAME HTML template the server uses.
  - Three actions on the preview:
    - **Looks good — send to tenant** → saves lease row, uploads PDF,
      moves lease to `pending_tenant_signature` (current behavior).
    - **Add custom clauses** → bottom sheet with a textarea; typed
      paragraphs get appended to a new "Additional Terms" section
      in the template.
    - **Cancel** → back to the form (edits preserved).
  - Zero new WYSIWYG editor; zero template surgery. Good enough for
    99% of landlord custom-terms needs.

  **v2 — Clause-level editing (if clients demand it after v1):**
  - Render the lease template as a structured list of clauses
    (migrate the HTML template to a JSON array of
    `{ id, title, body, deletable }`).
  - Preview screen shows each clause as a card with inline edit +
    delete + "add clause above / below" affordances.
  - "Required by RHA" clauses are flagged undeletable with a tooltip.
  - On confirm, the chosen clause set is rendered to HTML →
    `expo-print` → PDF → upload → same lease flow.

- **Implementation footprint for v1:**
  - New screen: `app/(owner)/leases/review/[applicationId].tsx`
  - New util: `src/features/leases/utils/renderLeaseHtml.ts` — pure
    function taking lease fields + custom-clauses array + property +
    parties → full HTML (shared with the server-side generator so
    the preview matches the final PDF byte-for-byte).
  - OwnerLeaseCreateScreen → on tap Create, instead of writing the
    row, it routes to the review screen with the form state as
    params.
  - Review screen uses `expo-print` `printToFileAsync()` to get a
    PDF URI, `WebBrowser.openBrowserAsync()` or `<WebView>` to
    display, and the existing `uploadFile` helper to persist.
  - Additional Terms are saved as a `lease_custom_clauses` text
    column on `leases` so they survive and appear on re-renders
    (renewals, PDF re-generation).

- **Depends on / interacts with:**
  - CT7-021 (lease create fail) — this new flow REPLACES the current
    create button; fixing #21's root cause still matters because the
    same code path writes the row at the end.
  - CT7-020 (date pickers) — unchanged; the preview reads whatever
    dates the picker produced.

- **Open questions for client:**
  1. v1 (append-only) or v2 (clause-level editor)? v1 ships in 2-3
     days; v2 is probably 2 weeks of work.
  2. Should custom clauses need a "legal review" flag before sending?
  3. Are there clauses that MUST appear (e.g. RHA §5A deposit
     return) that the owner shouldn't be able to delete?

- **Acceptance criteria (v1):**
  - [ ] Tapping Create Lease shows a scrollable PDF preview, not an
        instant "lease sent" success
  - [ ] Owner can type additional clauses into a textarea and see
        them appear in the preview
  - [ ] "Send to tenant" is the terminal action — same row, same
        status transition as today's Create button
  - [ ] Cancel preserves form state so the owner doesn't re-key the
        whole lease

## CT7-023 🟠 Define owner vs tenant maintenance responsibility + vendor-hire rights

- **Role:** owner + tenant (parity + policy)
- **Screen / flow:** Tenant → Maintenance → New Request · Owner → Maintenance
- **Problem (client's words):** _"Maintenance of services provided by
  property owner is for property owner to resolve and hire tenant [sic:
  vendor] for that. Tenants cannot ask other vendors to resolve. We
  need to define owner responsibility and tenant responsibility in
  maintenance and vendor management for that maintenance."_
- **Why this matters commercially:**
  - Property includes **Owner-provided systems** (geyser, aircon,
    gate motor, borehole pump, DStv, generator, security system, etc.).
    These are tied to the lease — the owner contracted the installing
    vendor; the owner typically holds the warranty.
  - If the tenant hires a different vendor for one of those systems
    the owner can void the warranty, accept a sub-par repair, and
    gets charged for work they didn't authorise.
- **Legal context (requires legal review before tenant-facing copy):**
  RHA + CPA are commonly interpreted as making the landlord responsible
  for upkeep of appliances supplied with the dwelling — but scope
  depends on the lease. This doc captures commercial intent; production
  copy must be legal-reviewed before shipping. Not relying on this as
  authoritative legal advice (per AI Engineer note on PR #200).
- **Current state (quick audit needed, but as of today):**
  - Tenant → Maintenance → New Request has a category picker that
    doesn't distinguish owner-provided vs tenant-owned systems.
  - After submit, the tenant can route to the vendor marketplace and
    pick ANY vendor — including for e.g. a geyser the owner installed.
  - Owner sees the request but has no veto over the tenant's chosen
    vendor; the owner isn't asked "do you want to handle this yourself?"
- **Suggested fix path (two-phase):**

  **v1 — Per-system routing on the property's own list:**

  _Storage (chosen approach — sidecar table, NOT text[] rewrite):_
  - New `property_service_items` table:
    `(id uuid, property_id uuid, name text, tenant_may_dispatch boolean,
created_at timestamp)`.
  - The existing `properties.services_provided text[]` is left in place
    for backward-compatibility reads; a one-shot backfill seeds the
    sidecar for each existing entry with `tenant_may_dispatch = true`
    (preserves today's behaviour for every pre-existing property so
    no owner is surprised by sudden restrictions). Default for NEW
    entries also defaults to `true` so the owner must explicitly opt
    a system into owner-dispatch-only.
  - Clients read from the sidecar; the text[] column is marked
    deprecated in the schema notes.

  _Request flow — identity, not category:_
  - Tenant maintenance request form adds a step: _"Which system
    is this about?"_ with two groups:
    1. Systems on this property (from `property_service_items` for
       the tenant's active lease).
    2. "Something else (my appliance / general)" fallback.
  - When the tenant picks a sidecar entry whose
    `tenant_may_dispatch = false`, the vendor marketplace is HIDDEN
    and the request is created with `status = 'awaiting_owner_dispatch'`
    and `service_item_id` pointing at the sidecar row.
  - When the tenant picks a `tenant_may_dispatch = true` entry OR the
    "something else" fallback, the existing marketplace flow runs
    unchanged.
  - Category alone never routes — only the explicit `service_item_id`
    does. Addresses Senior Dev's finding that "an aircon the tenant
    brought" isn't distinguishable from "the aircon the landlord
    installed" via category.

  _State machine for `maintenance_requests` (addresses Architect):_

  ```
  (new) ──────────────────────────────┐
     │                                 │
     v                                 v
  awaiting_owner_dispatch        tenant_dispatching
     │     ▲                           │
     │     └── owner reclaims ◀────────┤ (requires any open vendor
     │        (open PO + assignments  │  assignment / PO to be
     │         must be cancelled      │  cancelled FIRST)
     │         first)                 │
     v                                 │
  owner_dispatched ───────► in_progress ◀───┘
                                 │
                                 v
                             completed / disputed / cancelled
  ```

  - Cancellation allowed from `awaiting_owner_dispatch` by owner OR
    tenant (either party can close).
  - **Dispatch failure splits by authority** (addresses Senior Dev #1):
    - `owner_dispatched` → vendor declines → back to
      `awaiting_owner_dispatch` with an attempt counter; owner-side
      SLA alerts fire.
    - `tenant_dispatching` → vendor declines → STAYS in
      `tenant_dispatching` with the same counter; tenant picks a new
      vendor. Responsibility is NOT silently transferred to the owner.
  - **Owner reclaim pre-conditions** (addresses Senior Dev #2):
    `tenant_dispatching` → `awaiting_owner_dispatch` requires EITHER
    (a) no open `maintenance_vendor_assignments` row for the request,
    OR (b) every open assignment cancelled by the tenant AND any
    issued PO marked cancelled by the owner. An `owner_reclaim_reason`
    column records why the transition happened. Server-side gate is
    the UPDATE policy below.

  _Server-side enforcement — rewritten r3 to address Senior Dev,
  Architect, and Security findings on #200 r2. Three structural
  changes make the policies defensible:_

  **Change #1 — Snapshot dispatch authority onto the request row.**
  Previous spec claimed a snapshot but policies still consulted live
  `psi.tenant_may_dispatch`. Now `maintenance_requests` carries a
  `captured_tenant_may_dispatch boolean NOT NULL` column populated by
  a BEFORE INSERT trigger from the referenced sidecar row. The owner
  can retire / soft-delete the system later and in-flight requests
  keep the authority they were created under.

  **Change #2 — Protect ownership columns via UPDATE WITH CHECK.**
  Previous `mr_update` trusted the incoming `owner_id` / `tenant_id`.
  Now the WITH CHECK compares the proposed values against the EXISTING
  row's values — a tenant cannot rewrite `owner_id` to their own UID
  to satisfy the owner exception.

  **Change #3 — Caller must be a party to the request.**
  Explicit `tenant_id = auth.uid() OR owner_id = auth.uid()` on every
  INSERT / UPDATE / `mva_insert`. The property-via-FK dance was
  insufficient — an authenticated caller could satisfy a FK-only
  policy for anyone's request as long as the service-item check
  passed (or was null).

  **Reclaim transition — move out of RLS into an RPC.** Enforcing
  "any open assignment / PO must be cancelled first" in a WITH CHECK
  is the wrong shape (RLS doesn't look across tables cleanly). A
  SECURITY DEFINER RPC `reclaim_request(request_id uuid, reason text)`
  validates the pre-conditions atomically and flips the status; the
  UPDATE policy denies the status transition except via this RPC's
  exclusive window.

  ```sql
  -- property_service_items: owner RW; tenants on an active lease
  -- can SELECT rows for the leased property so the picker works.
  -- (Addresses Security finding that psi_rw was owner-only.)
  CREATE POLICY psi_owner_rw ON property_service_items
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM properties p
                   WHERE p.id = property_service_items.property_id
                     AND p.owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM properties p
                        WHERE p.id = property_service_items.property_id
                          AND p.owner_id = auth.uid()));

  CREATE POLICY psi_tenant_select ON property_service_items
    FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM leases l
      WHERE l.property_id = property_service_items.property_id
        AND l.tenant_id = auth.uid()
        AND l.status = 'active'
    ));

  -- Snapshot trigger: captures tenant_may_dispatch onto the request
  -- row at creation time AND forces an allowed initial status.
  -- Addresses PR #200 r4 Senior Dev finding that vendor_id=NULL
  -- requests could be inserted with any status.
  CREATE OR REPLACE FUNCTION capture_dispatch_authority()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF NEW.service_item_id IS NULL THEN
      NEW.captured_tenant_may_dispatch := true;
    ELSE
      SELECT tenant_may_dispatch INTO NEW.captured_tenant_may_dispatch
      FROM property_service_items
      WHERE id = NEW.service_item_id
        AND property_id = NEW.property_id;
      IF NEW.captured_tenant_may_dispatch IS NULL THEN
        RAISE EXCEPTION 'service_item_id does not belong to property_id';
      END IF;
    END IF;

    -- Force the initial status based on captured authority. Any client
    -- attempt to set status = 'completed' / 'in_progress' / etc. on
    -- INSERT is OVERWRITTEN here. Subsequent transitions go through
    -- the UPDATE policy + reclaim RPC.
    NEW.status := CASE
      WHEN NEW.captured_tenant_may_dispatch THEN 'tenant_dispatching'
      ELSE 'awaiting_owner_dispatch'
    END;

    RETURN NEW;
  END $$;

  CREATE TRIGGER trg_mr_capture_authority
    BEFORE INSERT ON maintenance_requests
    FOR EACH ROW EXECUTE FUNCTION capture_dispatch_authority();

  -- maintenance_requests INSERT: caller must be a party AND — if the
  -- caller is the tenant — must have an active lease for the request's
  -- property. Addresses PR #200 r4 Security finding that the earlier
  -- policy let an authenticated caller forge tenant_id to any UID.
  CREATE POLICY mr_insert ON maintenance_requests
    FOR INSERT TO authenticated
    WITH CHECK (
      -- owner path: caller is the property's actual owner
      (owner_id = auth.uid()
       AND EXISTS (SELECT 1 FROM properties p
                   WHERE p.id = maintenance_requests.property_id
                     AND p.owner_id = auth.uid()))
      OR
      -- tenant path: caller is the tenant AND has an active lease on
      -- the request's property AND owner_id matches the property's
      -- actual owner (blocks tenant forging owner_id to themselves)
      (tenant_id = auth.uid()
       AND EXISTS (
         SELECT 1 FROM leases l
         JOIN properties p ON p.id = l.property_id
         WHERE l.tenant_id = auth.uid()
           AND l.property_id = maintenance_requests.property_id
           AND l.status = 'active'
           AND p.owner_id = maintenance_requests.owner_id))
      -- pre-attach rules:
      --   unlinked          (captured = true, enforced by trigger)
      --   tenant-OK system  (captured = true)
      --   locked system     (captured = false) → only owner can pre-attach
      AND (vendor_id IS NULL
           OR captured_tenant_may_dispatch = true
           OR maintenance_requests.owner_id = auth.uid())
    );

  -- maintenance_requests UPDATE:
  -- 1. caller must be a party
  -- 2. service_item_id + captured_tenant_may_dispatch + owner_id +
  --    tenant_id + property_id are sealed (cannot be rewritten)
  -- 3. vendor_id follows the same authority rule as INSERT
  -- 4. status transitions blocked except via RPCs (tenant reclaim path)
  CREATE POLICY mr_update ON maintenance_requests
    FOR UPDATE TO authenticated
    USING (tenant_id = auth.uid() OR owner_id = auth.uid())
    WITH CHECK (
      -- immutable identity + policy columns (compare to existing row)
      tenant_id = (SELECT tenant_id FROM maintenance_requests mr2
                   WHERE mr2.id = maintenance_requests.id)
      AND owner_id = (SELECT owner_id FROM maintenance_requests mr2
                      WHERE mr2.id = maintenance_requests.id)
      AND property_id = (SELECT property_id FROM maintenance_requests mr2
                         WHERE mr2.id = maintenance_requests.id)
      AND service_item_id IS NOT DISTINCT FROM
          (SELECT service_item_id FROM maintenance_requests mr2
           WHERE mr2.id = maintenance_requests.id)
      AND captured_tenant_may_dispatch = (SELECT captured_tenant_may_dispatch
                                          FROM maintenance_requests mr2
                                          WHERE mr2.id = maintenance_requests.id)
      -- vendor_id: allowed by the captured authority or by the owner
      AND (vendor_id IS NULL
           OR captured_tenant_may_dispatch = true
           OR owner_id = auth.uid())
      -- status transitions to awaiting_owner_dispatch from
      -- tenant_dispatching MUST go through reclaim_request() RPC
      -- (see below). The RPC runs SECURITY DEFINER with set_config
      -- 'app.reclaim_in_progress' = 'true' which this policy allows.
      AND (status IS NOT DISTINCT FROM
           (SELECT status FROM maintenance_requests mr2
            WHERE mr2.id = maintenance_requests.id)
           OR NOT (
             (SELECT status FROM maintenance_requests mr2
              WHERE mr2.id = maintenance_requests.id) = 'tenant_dispatching'
             AND status = 'awaiting_owner_dispatch'
           )
           OR current_setting('app.reclaim_in_progress', true) = 'true')
    );

  -- SECURITY DEFINER RPC for owner reclaim: validates no open
  -- assignments / POs exist (or all are cancelled), bumps the status,
  -- and writes the audit field. The policy above only allows the
  -- transition while this function's exclusive flag is set.
  CREATE OR REPLACE FUNCTION reclaim_request(req_id uuid, reason text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
  DECLARE open_assignments int;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM maintenance_requests
                   WHERE id = req_id AND owner_id = auth.uid()) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;

    SELECT count(*) INTO open_assignments
    FROM maintenance_vendor_assignments
    WHERE request_id = req_id AND status NOT IN ('cancelled', 'rejected');

    IF open_assignments > 0 THEN
      RAISE EXCEPTION 'cancel open vendor assignments first';
    END IF;

    PERFORM set_config('app.reclaim_in_progress', 'true', true);
    UPDATE maintenance_requests
    SET status = 'awaiting_owner_dispatch',
        owner_reclaim_reason = reason,
        updated_at = now()
    WHERE id = req_id;
    PERFORM set_config('app.reclaim_in_progress', 'false', true);
  END $$;

  -- maintenance_vendor_assignments INSERT: caller must be an authorized
  -- party to the request (tenant for tenant-dispatchable; owner for
  -- owner-dispatched). Uses the SNAPSHOTTED captured_tenant_may_dispatch
  -- so retiring the sidecar item never changes in-flight authority.
  CREATE POLICY mva_insert ON maintenance_vendor_assignments
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM maintenance_requests mr
        WHERE mr.id = maintenance_vendor_assignments.request_id
          AND (
            (mr.captured_tenant_may_dispatch = true AND mr.tenant_id = auth.uid())
            OR mr.owner_id = auth.uid()
          )
      )
    );
  ```

  _Write path — bi-directional sync during cutover (r4 — addresses
  Architect's PR #200 r4 finding that old-client writes to the legacy
  column become invisible to the new sidecar):_
  - Primary writes from the new app go to `property_service_items`.
  - Forward trigger (`AFTER INSERT / UPDATE / DELETE` on sidecar)
    REBUILDS `properties.services_provided text[]` from the current
    sidecar rows (names only, `deleted_at IS NULL`). Old-client
    reads stay fresh.
  - **Reverse trigger** (`AFTER UPDATE OF services_provided ON properties`)
    reconciles the sidecar when an old client still writes the legacy
    column: for each name that appears in the new array but not in
    sidecar, INSERT a sidecar row with `tenant_may_dispatch = true`;
    for each name in sidecar that's absent from the new array, mark
    `deleted_at = now()`. Guarded against infinite-loop with a
    session-scoped `app.sync_in_progress` flag — both triggers skip
    their work while the other is running. This closes the window
    where old-client writes vanished.
  - A follow-up migration (post full-rollout) drops the legacy
    column AND both triggers.

  _Deletion semantics (addresses Architect #2):_
  - `property_service_items.deleted_at` soft-deletes.
  - Existing `maintenance_requests.service_item_id` FK survives.
  - UI hides deleted items from the tenant selection picker.
  - For locked items with open requests: the policy decision
    (`tenant_may_dispatch`) is READ from the snapshot at request-create
    time — the policy is captured on the request row at insert and the
    FK is only used for display. Deleting the item never silently
    unlocks a pending request.

  **v2 — Full responsibility matrix (deferred):**
  - Admin-side matrix per property: category × subcategory → owner /
    tenant / either, plus cost-allocation rules (owner pays / tenant
    pays / split) and an audit trail of every dispatch decision.
  - ~2–3 weeks. Defer until v1 proves the model in production.

- **Legal copy / tenant education needed:**
  - Tenant request screen shows a small explainer: _"Some systems in
    this property are the landlord's to repair. For those, the landlord
    will arrange the vendor. For your own appliances, you choose."_
- **Depends on / interacts with:**
  - CT7-022 (lease preview + edit) — the lease should list owner-
    provided systems so the tenant has agreed to this upfront.
  - Decision: SIDECAR table chosen over text[] mutation (see Storage
    section above) — resolves PR #200 Architect finding on the
    stored-data contract.
- **Open questions for client:**
  1. Should the owner be able to OVERRIDE and say "for this specific
     geyser issue, go ahead and hire your own vendor"? (one-off waiver)
  2. What happens to cost reimbursement? If the tenant DOES get a
     vendor for a landlord system in an emergency (burst geyser,
     3am), does the landlord reimburse?
  3. Confirmed: legacy entries default to `tenant_may_dispatch = true`
     (today's behaviour); new entries also default to `true`; owner
     opts each system INTO owner-only dispatch.
- **Acceptance criteria (v1):**
  - [ ] Owner can mark each service-provided entry as
        "tenant may NOT hire own vendor"
  - [ ] Tenant request form shows a picker of this property's systems;
        selecting a locked system routes straight to owner (not by
        category alone)
  - [ ] "Something else" fallback remains open to the marketplace
  - [ ] Owner inbox shows an "Awaiting your action" section
  - [ ] Owner picks a vendor and the normal PO flow resumes
  - [ ] Server-side RLS rejects a tenant-direct vendor assignment on
        a locked system — not just the UI
  - [ ] All existing (migrated) services default to
        `tenant_may_dispatch = true` — no silent restriction on
        today's live properties
  - [ ] State transitions match the diagram above; dispatch failure
        bounces back to `awaiting_owner_dispatch` with a counter
  - [ ] Tenant sees a clear explanation on the request screen (copy
        legal-reviewed before shipping)
