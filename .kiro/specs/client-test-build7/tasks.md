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
