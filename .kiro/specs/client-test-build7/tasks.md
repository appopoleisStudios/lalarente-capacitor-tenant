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
  - When the tenant picks a `tenant_may_dispatch = true` entry, the
    existing marketplace flow runs unchanged.
  - When the tenant picks the "Something else" fallback
    (`service_item_id IS NULL`), the trigger forces
    `captured_tenant_may_dispatch = false` and
    `status = 'awaiting_owner_dispatch'` — it goes to owner triage
    FIRST (updated r7, addresses PR #200 r6 Senior Dev P2 which
    rightly caught that the previous spec text contradicted the
    database behaviour). The owner either keeps the request as
    owner-dispatched OR calls `release_to_tenant_dispatch()` which
    flips to `tenant_dispatching` and the tenant is notified they
    can now pick a vendor. Tenant NEVER lands in the marketplace
    directly on "Something else".
  - Category alone never routes — only the explicit `service_item_id`
    (or lack of one, which blocks pending triage) does. Addresses the
    original Senior Dev finding that "an aircon the tenant brought"
    isn't distinguishable from "the aircon the landlord installed"
    via category.

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
  - **Owner reclaim pre-conditions** (rewritten r5 — PR #200 Senior
    Dev found that the previous OR let reclaim through while a PO was
    still active): reclaim requires BOTH
    - **(a)** every `maintenance_vendor_assignments` row for the
      request is in a terminal status (`cancelled` or `rejected`), AND
    - **(b)** every `purchase_orders` row for the request is also in
      a terminal status (`cancelled` or `closed`).
      An assignment that closed naturally (e.g. vendor completed and
      the owner issued a PO that's still outstanding) does NOT satisfy
      (a) alone — the PO must also be settled. `owner_reclaim_reason`
      records why. Enforcement happens inside the `reclaim_request()`
      RPC below, not via UPDATE policy — WITH CHECK can't reasonably
      walk two sibling tables.

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
  --
  -- PR #200 r5 Security P1: unlinked ("Something else") requests used
  -- to default captured_tenant_may_dispatch=true, letting a tenant
  -- route an owner-provided-system issue through the fallback. Now
  -- unlinked requests default to FALSE — they route to owner triage
  -- first, and the owner either leaves them as owner-dispatched OR
  -- flips captured_tenant_may_dispatch=true after reading the body.
  -- Linked-system requests still use the sidecar's flag.
  CREATE OR REPLACE FUNCTION capture_dispatch_authority()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF NEW.service_item_id IS NULL THEN
      -- Owner (inserting on their own behalf) can opt tenant-dispatch
      -- in on INSERT. Tenant-inserted unlinked requests always start
      -- in awaiting_owner_dispatch — tenant cannot self-authorize.
      IF NEW.owner_id = auth.uid() THEN
        NEW.captured_tenant_may_dispatch :=
          COALESCE(NEW.captured_tenant_may_dispatch, false);
      ELSE
        NEW.captured_tenant_may_dispatch := false;
      END IF;
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
    -- the UPDATE policy + reclaim RPC (and the owner-triage RPC
    -- `release_to_tenant_dispatch` for unlinked requests).
    NEW.status := CASE
      WHEN NEW.captured_tenant_may_dispatch THEN 'tenant_dispatching'
      ELSE 'awaiting_owner_dispatch'
    END;

    RETURN NEW;
  END $$;

  -- Owner triage for unlinked requests: after reviewing the body the
  -- owner can either keep the request (own-dispatch) or RELEASE it
  -- back to tenant_dispatching (e.g. "oh this is your own kettle").
  -- Same exclusive-flag pattern as reclaim_request so the UPDATE
  -- policy sealing captured_tenant_may_dispatch doesn't need to
  -- special-case this transition.
  CREATE OR REPLACE FUNCTION release_to_tenant_dispatch(req_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
    -- Hardening (PR #200 r6 Security P1): SECURITY DEFINER functions
    -- without an explicit search_path are vulnerable to object-shadowing
    -- attacks. Setting a trusted path with pg_temp LAST (empty) means a
    -- caller can't introduce a same-named temp relation that resolves
    -- before our intended one.
    SET search_path = public, pg_catalog, pg_temp
  AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.maintenance_requests
      WHERE id = req_id
        AND owner_id = auth.uid()
        AND service_item_id IS NULL
        AND status = 'awaiting_owner_dispatch'
    ) THEN
      RAISE EXCEPTION 'not authorized or not an unlinked request';
    END IF;

    PERFORM set_config('app.triage_in_progress', 'true', true);
    UPDATE public.maintenance_requests
    SET captured_tenant_may_dispatch = true,
        status = 'tenant_dispatching',
        updated_at = now()
    WHERE id = req_id;
    PERFORM set_config('app.triage_in_progress', 'false', true);
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

  -- SECURITY DEFINER RPC for owner reclaim — validates BOTH open
  -- vendor_assignments AND open purchase_orders are terminated before
  -- flipping the status. PR #200 r5 Senior Dev finding: an assignment
  -- could close naturally while its PO stayed outstanding.
  CREATE OR REPLACE FUNCTION reclaim_request(req_id uuid, reason text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
    -- Hardening (PR #200 r6 Security P1): SECURITY DEFINER functions
    -- without an explicit search_path are vulnerable to object-shadowing
    -- attacks. Setting a trusted path with pg_temp LAST (empty) means a
    -- caller can't introduce a same-named temp relation that resolves
    -- before our intended one.
    SET search_path = public, pg_catalog, pg_temp
  AS $$
  DECLARE
    open_assignments int;
    open_pos int;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.maintenance_requests
                   WHERE id = req_id AND owner_id = auth.uid()) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;

    -- Pre-condition (a): every assignment must be cancelled / rejected.
    SELECT count(*) INTO open_assignments
    FROM public.maintenance_vendor_assignments
    WHERE request_id = req_id
      AND status NOT IN ('cancelled', 'rejected');

    IF open_assignments > 0 THEN
      RAISE EXCEPTION 'cancel open vendor assignments first';
    END IF;

    -- Pre-condition (b): every PO must be cancelled / closed.
    -- Checking assignments alone (prior spec) let a reclaim through
    -- while a PO was still active for a closed assignment.
    SELECT count(*) INTO open_pos
    FROM public.purchase_orders
    WHERE request_id = req_id
      AND status NOT IN ('cancelled', 'closed');

    IF open_pos > 0 THEN
      RAISE EXCEPTION 'close or cancel open purchase orders first';
    END IF;

    PERFORM set_config('app.reclaim_in_progress', 'true', true);
    UPDATE public.maintenance_requests
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
  - [ ] "Something else" fallback goes to owner triage first;
        marketplace only opens after `release_to_tenant_dispatch()`
  - [ ] Owner can call release_to_tenant_dispatch() on an unlinked
        request to flip it to tenant_dispatching
  - [ ] An unlinked request that the owner does NOT release stays in
        owner-dispatched flow end-to-end
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

## CT7-024 🟠 Owner — record property taxes + roll into annual tax sheet

- **Role:** owner
- **Screen / flow:** Owner → Property → Taxes → Record payment · Owner →
  Tax Reports (existing ITR12 summary screen)
- **Problem (client's words):** _"Taxes being paid by owner on property
  should be recordable in app and finally in yearly tax sheet
  calculations."_
- **Context — what's already there:**
  - `OwnerTaxReportScreen` exists (SA tax year March–Feb) with ITR12
    summary + 3-year history. Shipped in the parity work earlier in
    the year.
  - Owner-side expenses are not currently captured on the property
    level — only rent income, maintenance costs, and vendor payments
    get rolled up. Property taxes (municipal rates, levies, transfer
    duty amortisation) are NOT yet ingested.
- **Why this matters:** the SARS ITR12 rental schedule itemises
  rates, levies, bond interest, insurance, and repairs separately.
  Without the owner recording these inside the app, the tax-report
  screen understates deductions and the owner has to reconcile
  manually at year-end.
  _Note from PR #201 r3:_ specific SARS source-code numbers are
  intentionally NOT hard-coded in this spec — the SA verified my
  earlier guesses (4208–4211) were historical codes, not the current
  rental schedule. Code mapping is confirmed against the live SARS
  source-code list at implementation time; the data model is
  category-based, not code-based.

- **Suggested fix path:**

  _Schema (new table — no mutation to existing):_

  ```sql
  CREATE TABLE property_tax_payments (
    id              uuid primary key default gen_random_uuid(),
    property_id     uuid not null references properties(id) on delete cascade,
    owner_id        uuid not null references profiles(id),
    category        text not null check (category in (
                      'municipal_rates',
                      'municipal_levies',
                      'sectional_title_levy',
                      'bond_interest',
                      'insurance',
                      -- 'repairs_maintenance' intentionally NOT listed —
                      -- the existing maintenance + vendor payments already
                      -- feed the tax report via their own pipelines.
                      -- Including it here would double-count (Architect
                      -- finding on PR #201 r4). Added only when the owner
                      -- pays a vendor directly OUTSIDE the app and wants
                      -- to attribute it; UI gates the category behind an
                      -- "I paid this outside Lalarente" opt-in.
                      'other'
                    )),
    description     text,
    amount          numeric(12,2) not null check (amount > 0),
    paid_on         date not null,
    -- Qualification for deductibility — addresses PR #201 r3 Architect
    -- finding. Owners record the raw expense; the tax summary only
    -- subtracts rows explicitly marked 'allowable'. Default 'uncertain'
    -- so unreviewed entries don't silently become deductions.
    deductibility   text not null default 'uncertain'
                      check (deductibility in (
                        'allowable',       -- fully deductible
                        'capital',         -- capital expenditure, not deductible
                        'mixed_use',       -- requires apportionment
                        'private',         -- private/non-rental portion
                        'uncertain'        -- not yet classified
                      )),
    apportionment_pct numeric(5,2)
      check (apportionment_pct is null
             or (apportionment_pct >= 0 and apportionment_pct <= 100)),
      -- Required (NOT NULL) when deductibility='mixed_use'; validated
      -- by a row-level CHECK so the form can't submit missing / out-of-
      -- range percentages (PR #201 r4 Senior Dev P2).
      -- Enforced via the table-level CHECK below.
    document_url    text,                  -- optional receipt / proof
    created_at      timestamptz default now(),
    -- Table-level: apportionment_pct must be set when deductibility is
    -- mixed_use; must be null otherwise so the CSV export isn't ambiguous.
    CONSTRAINT ptp_apportionment_required_for_mixed CHECK (
      (deductibility = 'mixed_use' AND apportionment_pct IS NOT NULL)
      OR (deductibility <> 'mixed_use' AND apportionment_pct IS NULL)
    )
  );

  CREATE INDEX idx_prop_tax_owner_year ON property_tax_payments
    (owner_id, paid_on);
  ```

  _RLS (addresses PR #201 Security findings on UPDATE path + ENABLE):_

  ```sql
  -- Mandatory: enable RLS on the table BEFORE creating policies.
  -- Without these ALTERs the policies are inert and the table defaults
  -- to open for any authenticated user with table-level GRANT. SA
  -- finding on r2.
  ALTER TABLE property_tax_payments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE property_tax_payments FORCE ROW LEVEL SECURITY;

  -- SELECT: your own payments only
  CREATE POLICY ptp_select ON property_tax_payments
    FOR SELECT TO authenticated
    USING (owner_id = auth.uid());

  -- INSERT: row must belong to you AND the property must be yours
  CREATE POLICY ptp_insert ON property_tax_payments
    FOR INSERT TO authenticated
    WITH CHECK (
      owner_id = auth.uid()
      AND EXISTS (SELECT 1 FROM properties p
                  WHERE p.id = property_id AND p.owner_id = auth.uid())
    );

  -- UPDATE: USING guards the EXISTING row (you own it + its property);
  -- WITH CHECK guards the RESULTING row (you still own it + the NEW
  -- property_id is also yours). Blocks "swap property_id to another
  -- owner's property while keeping owner_id" per Security finding.
  CREATE POLICY ptp_update ON property_tax_payments
    FOR UPDATE TO authenticated
    USING (
      owner_id = auth.uid()
      AND EXISTS (SELECT 1 FROM properties p
                  WHERE p.id = property_id AND p.owner_id = auth.uid())
    )
    WITH CHECK (
      owner_id = auth.uid()
      AND EXISTS (SELECT 1 FROM properties p
                  WHERE p.id = property_id AND p.owner_id = auth.uid())
    );

  -- DELETE: same USING clause (you own the row and its property)
  CREATE POLICY ptp_delete ON property_tax_payments
    FOR DELETE TO authenticated
    USING (
      owner_id = auth.uid()
      AND EXISTS (SELECT 1 FROM properties p
                  WHERE p.id = property_id AND p.owner_id = auth.uid())
    );
  ```

  - Admin / superuser RLS as elsewhere in the app.

  _UI — property-level ledger:_
  - New screen `app/(owner)/properties/[id]/taxes.tsx` listing tax
    payments for the selected property.
  - "Record payment" form fields (expanded per PR #201 r4 Senior Dev
    P1 — deductibility was previously not exposed in the UI):
    1. **Category** picker (municipal_rates, levies, …)
    2. **Amount** (ZAR)
    3. **Paid on** date (CT7-020 picker pattern)
    4. **Deductibility** picker, required:
       - "Fully deductible against rental income" → `allowable`
       - "Capital expenditure (not deductible)" → `capital`
       - "Shared with personal use — I'll apportion" → `mixed_use`
       - "Private / non-rental" → `private`
       - "Not sure yet — I'll classify later" → `uncertain`
    5. **Apportionment %** — visible + required ONLY when deductibility
       = `mixed_use`. Slider / numeric input bounded 0–100.
    6. **Receipt** — optional file upload (reuses
       `src/lib/storage.ts::uploadFile()`).
       Existing entries display their current deductibility and can be
       edited to re-classify.
  - Delete + edit on each row (RLS gated).

  _Rollup into existing tax-report screen:_
  - `OwnerTaxReportScreen` fetches:
    - current `rentIncomeByMonth`
    - new `taxExpensesByCategory` from `property_tax_payments` grouped
      by SA tax year with a **half-open range** so Feb 29 in leap
      years is included (addresses PR #201 Senior Dev finding):
      `paid_on >= 'yyyy-03-01' AND paid_on < '(yyyy+1)-03-01'`.
      NEVER `BETWEEN 'yyyy-03-01' AND '(yyyy+1)-02-28'` — that drops
      Feb 29 every four years.
  - Numbers surfaced on the report (category names only — specific
    SARS source codes confirmed at implementation time against the
    live source-code list):
    - Rates · Levies · Bond interest · Insurance · Repairs &
      maintenance · Other recorded.
  - **Deductible subtotal** — SUM over rows WHERE
    `deductibility = 'allowable'` plus `amount * apportionment_pct/100`
    WHERE `deductibility = 'mixed_use'`. `capital`, `private`, and
    `uncertain` rows are LISTED on the report (so the owner sees them)
    but EXCLUDED from the Net rental income subtraction.
  - Net rental income: income − maintenance − vendor payments −
    DEDUCTIBLE SUBTOTAL.
  - Existing 3-year history grid gains two columns: "Rates" +
    "Levies" so the owner sees trend.

  _Export:_
  - Add "Export CSV" on the tax-report screen (reuses `expo-sharing`
    pattern used by the lease PDF). Column shape covers the ITR12
    rental schedule categories; the owner's accountant maps the
    categories to the live SARS source codes at year-end filing time.
    (Dropped the "maps 1:1" promise per PR #201 r3 — the historical
    code numbers I cited were wrong, and the live code list changes
    between tax years.)

- **Legal / compliance note (not production copy):**
  App does not and must not render tax advice. The report is a
  summary of what the owner recorded; final ITR12 reconciliation
  stays with SARS / their tax practitioner. Microcopy on the screen
  must say so.

- **Depends on / interacts with:**
  - CT7-018 (holding deposit bank reference) — unrelated; just
    makes OTHER reconciliation easier.
  - Existing `OwnerTaxReportScreen` — this issue extends it; no
    breaking changes to its public route or props.

- **Open questions for client:**
  1. Scope: just RATES + LEVIES + BOND INTEREST + INSURANCE for v1,
     or also depreciation / capital improvements (which need separate
     SARS treatment)?
  2. Do we want multi-property tax aggregation at the Portfolio
     level, or strictly per-property?
  3. Receipt upload: required or optional? (SARS audit trail if
     required.)
  4. Reminder / schedule: recurring entries (monthly levy auto-add
     on the 1st) or ad-hoc only?

- **Acceptance criteria (v1):**
  - [ ] Owner can navigate to a property's taxes screen and record a
        payment (category, amount, date, optional receipt).
  - [ ] Records persist per-property and per-owner under RLS.
  - [ ] Existing OwnerTaxReportScreen pulls tax payments into the SA
        tax year total and a category breakdown. Specific SARS source-
        code labels are confirmed against the live source-code list at
        implementation time, not hard-coded in this spec.
  - [ ] Owner can export a CSV with the category breakdown columns.
        Mapping categories to specific SARS codes for the relevant tax
        year is a manual step for the owner's accountant (per AI
        Engineer finding on r4 — mapping conditional on a verified
        code list, not promised as automatic).
  - [ ] Multi-property owners see per-property AND portfolio
        aggregation (if open-question #2 resolved as yes).
  - [ ] Legal microcopy: "This summary is not tax advice."

## CT7-025 🟡 Tenant Profile "Profile complete" badge disagrees with dashboard banner

- **Role:** tenant
- **Screen / flow:** Tenant → Dashboard → Profile
- **Problem (found during end-to-end walkthrough on 2026-11-07
  evening):** on the tenant Profile screen the top shows a green
  "Profile complete" badge, while on the Dashboard the "Complete
  Your Profile" banner still lists "SA ID document" and "Salary
  certificate / payslip" as missing.
- **Root cause:** two independent completeness checks disagree.
  - Dashboard banner reads from `checkTenantProfileCompleteness()`
    (the shared util added in CT7-013 + CT7-014 — includes the
    document uploads).
  - TenantProfileScreen has its own inline check that predates
    CT7-014 and only inspects the editable text fields (name,
    phone, ID, DOB, proof of address). Document uploads introduced
    by CT7-014 aren't part of that check.
- **Fix path:**
  - Replace the Profile screen's inline check with a call to
    `checkTenantProfileCompleteness()`. Show the same missing-field
    list the dashboard uses.
  - The badge then becomes a derived `isComplete` flag; remove the
    separate state.
- **Acceptance criteria:**
  - [ ] Profile screen and dashboard banner are always in sync.
  - [ ] If any CT7-014 doc is missing, Profile shows a warning
        state (not green "complete").
  - [ ] Uploading the missing docs flips both surfaces to complete
        on the next render.

## Client test of build 10 (2026-11-15)

## CT7-026 🟡 Dashboard still takes ~1 s to appear ✅ (PR #241)

- **Role:** owner + tenant · **Reported:** client test of build 10
- **Today:** after sign-in the cached dashboard is gone (cleared on sign-out
  for privacy), so the first screen is a full-page "Loading dashboard…"
  spinner until the data arrives (~0.5–1.5 s on the emulator).
- **Acceptance criteria:**
  - [ ] The dashboard layout (header, sections) paints immediately after
        sign-in with skeleton placeholders; no full-screen spinner.
  - [ ] Data fills in as it arrives; measured on the Android release APK.

## CT7-027 🟠 Google address search missing on Add Property (regression) ✅ (PR #235)

- **Role:** owner · **Screen:** Add Property → Street Address
- **Cause:** commit 97786bb ("Fix white screen on Add Property") removed the
  whole LocationPicker — map _and_ Google Places search — because the map
  (react-native-maps) crashed. Only Edit Property kept the search.
- **Acceptance criteria:**
  - [ ] Add Property has Google Places address search (SA only) that fills
        street, city, province, postal code — without the map component.
  - [ ] Edit Property search verified on the release APK.
  - [ ] Maestro flow types an address and picks a suggestion.

## CT7-028 🟠 Sign-in errors should say what went wrong ✅ (PR #239)

- **Role:** all · **Screen:** Sign in
- **Today:** a generic failure message.
- **Note (security/POPIA):** telling a stranger "no account with this
  email" lets anyone discover who uses the app (account enumeration,
  OWASP ASVS 2.x). The safe pattern: one message for wrong email-or-password,
  plus specific messages for everything else that is safe to reveal.
- **Acceptance criteria:**
  - [ ] Specific messages: empty field, invalid email format, wrong email or
        password, email not confirmed, too many attempts, no connection.
  - [ ] Unit tests map each Supabase auth error to its message.

## CT7-029 🟠 Ending a lease leaves future rent "due" ✅ (PR #240)

- **Role:** tenant + owner · **Found:** resetting test data for the client
- **Today:** when a lease is terminated or ended early, its pending rent
  payments stay pending, so the tenant still sees rent due on a lease that
  has ended. Payments have no void status; the owner may only set `failed`.
- **Acceptance criteria:**
  - [ ] Ending a lease (terminate / early termination / expiry) voids its
        future unpaid rent; paid and past-due amounts are untouched.
  - [ ] Tenant dashboard/Payments no longer show rent for an ended lease.
  - [ ] Database-level so every path (app, automation) is covered; test.

## CT7-030 🟠 Tenant can request a viewing again while one is open ✅ (PR #236)

- **Role:** tenant · **Screen:** Property detail → Request Viewing
- **Today:** nothing stops a tenant from requesting another viewing of the
  same property while a request is pending or approved (test data shows
  many duplicates).
- **Acceptance criteria:**
  - [ ] While the tenant has a pending or approved viewing for that
        property, "Request Viewing" is greyed out with the reason shown.
  - [ ] Enabled again once the owner declines (or the viewing is
        cancelled / completed).
  - [ ] Enforced in the database too (no duplicate open request).

## CT7-031 🟠 Opened notifications still count on the bell ✅ (PR #238)

- **Role:** all · **Screen:** header bell → Notifications
- **Today:** after tapping a notification and viewing it, it still shows as
  unread and the bell's number doesn't go down.
- **Acceptance criteria:**
  - [ ] Opening a notification marks it read (read_at set) in the database.
  - [ ] The bell count drops immediately and stays dropped after leaving
        and returning to the screen / restarting the app.
  - [ ] Works for owner, tenant and vendor; Maestro flow covers it.

## CT7-032 🟠 "Apply Now" works while a viewing is still upcoming ✅ (PR #236)

- **Role:** tenant · **Screen:** Property detail → Apply Now
- **Today:** a tenant with a scheduled (pending/approved) viewing can apply
  before the viewing has happened.
- **Acceptance criteria:**
  - [ ] While the tenant's viewing for that property is pending or approved
        and its date hasn't passed, "Apply Now" is disabled with the reason.
  - [ ] Enabled once the viewing date has passed, the viewing is marked
        viewed/completed, or it is cancelled/declined.
  - [ ] Enforced server-side too (application insert rejected), with test.

## CT7-033 🟠 Back must go to the previous screen, everywhere, every role ✅ (PR #242)

- **Role:** owner, tenant, vendor · **Platforms:** Android + iOS
- **Today:** some screens' back arrow (and Android system back) jump to the
  dashboard instead of the screen the user came from.
- **Acceptance criteria:**
  - [ ] Header back arrow returns to the previous screen on every screen.
  - [ ] Android: system back button / gesture does the same; on a tab root
        it follows Android convention (previous tab history, then exit).
  - [ ] iOS: back arrow and edge swipe-back return to the previous screen.
  - [ ] Audit every route for all three roles; Maestro regression flow per
        role covering deep navigation → back → back.

### Also fixed during the build-10 client test (not raised by the client)

- Sign-out now ends only this device's session; it used to sign the user
  out on every device (PR #237).
- Push notifications never worked: the push_tokens table had never been
  created live. Created, and a device's token now follows whoever signs in
  and is removed on sign-out (PR #237).
- Security: a tenant could end their own lease with a back-dated date and
  wipe rent already owed; only the landlord can end a lease now (PR #240).

## Known open issues in build 11 (2026-11-15)

Found by us while fixing and testing build 11 (CT7-034, 036–039 are listed in
`builds/BUILD_INFO-1.0.0-build.11-rev.0.txt`; CT7-035 found during testing).
Not raised by the client.

## CT7-034 🔴 ID documents readable by anyone holding the link (POPIA)

- **Role:** tenant (data owner) · **Area:** Supabase storage `documents` bucket
- **Today:** the bucket was found public on the live project (set outside
  migrations) and the app stores public URLs. Listing is closed (PR #232), but
  anyone with a file's exact URL can open a tenant's ID document or payslip.
  Vendor documents share the bucket.
- **Acceptance criteria:**
  - [ ] `documents` bucket set to private via a migration.
  - [ ] Every place that shows or downloads a document uses a short-lived
        signed URL (same pattern as `getLeaseDocumentUrl` in `storageService`).
  - [ ] Owner can still view their applicants'/tenants' documents; a
        non-party gets 400/403. Test for both.

## CT7-035 🔴 Lease rent and deposit can still be changed by either party

- **Role:** owner + tenant · **Area:** `leases` table guards
- **Today:** wording, parties and signatures are locked (PR #229) and only
  the owner can end a lease (PR #240), but `leases.monthly_rent` and
  `leases.deposit_amount` can still be updated by the tenant or the owner after signing.
- **Acceptance criteria:**
  - [ ] Database trigger rejects changes to rent/deposit once the lease is
        signed by either party (changes go through a renewal/addendum).
  - [ ] Tenant can never change them, before or after signing.
  - [ ] Regression test: REST update as tenant and as owner on a signed
        lease is rejected.

## CT7-036 🟠 Early termination and payment disputes don't notify the other party

- **Role:** owner + tenant · **Area:** notifications
- **Today:** when a tenant requests early termination or disputes a payment
  (or the owner responds), no in-app or push notification is created; the
  other party only sees it if they open that screen.
- **Acceptance criteria:**
  - [ ] Request, accept and reject of early termination notify the other
        party (bell + push).
  - [ ] Dispute opened / under review / resolved notifies the other party.
  - [ ] Tapping the notification opens the right screen; Maestro flow.

## CT7-037 🟠 Push notifications are sent from the phone, not the server

- **Area:** push delivery
- **Today:** for in-app actions the phone sends the push itself
  (`notificationsApi.ts`). If the sender's app closes or loses connection,
  the push is lost. Only `process-lease-automation` sends server-side
  (`_shared/expoPush.ts`).
- **Acceptance criteria:**
  - [ ] A database trigger / edge function sends the push when a
        notification row is inserted.
  - [ ] App-side sending removed; no duplicate pushes.
  - [ ] Test: notification inserted server-side reaches the device.

## CT7-038 🟡 Owner rent roll doesn't label voided rent as cancelled

- **Role:** owner · **Screen:** Rent Roll
- **Today:** rent voided because a lease ended (CT7-029, status
  `cancelled`) has no proper label on the owner's rent roll; the tenant
  side already shows "Not due — lease ended".
- **Acceptance criteria:**
  - [ ] Rent roll shows a grey "Cancelled — lease ended" status and leaves
        these amounts out of due/arrears totals.
  - [ ] Unit test for the status mapping.

## CT7-039 🟡 Client and automated tests share the same accounts

- **Area:** test process
- **Today:** the client (Navin) tests with the same owner/tenant accounts
  the E2E suite uses. The suite has touched his real records (96 De Waal
  holding deposit, restored), and his data makes test results noisy.
- **Acceptance criteria:**
  - [ ] Separate owner, tenant and vendor accounts created for the client.
  - [ ] E2E fixture accounts are used only by the suite; lifecycle flows
        refuse to act on records outside the fixture, with a test that a
        non-fixture record is rejected.

## Client test of build 11 (2026-11-16)

Navin terminated the one active lease from the tenant app. The termination
itself worked; the issues below are what followed.

## CT7-040 🟠 Owner can't reduce or waive the early-termination penalty

- **Role:** owner · **Screen:** Early termination (owner side)
- **Today:** the penalty is hard-coded as min(2, months remaining) × rent
  (`calculatePenaltyAmount`, `src/features/leases/api/leaseTermination.api.ts:26`)
  — R11 000 in Navin's test — and is written to
  `leases.early_termination_penalty` by the requester's session (the tenant,
  `:120`). The owner has no way to lower it, e.g. to 1 month (R5 500) when a
  replacement tenant takes over. CPA s14 requires a reasonable penalty, and
  under common law the landlord must mitigate (re-let), so a reduction or
  waiver is a normal outcome.
- **Acceptance criteria:**
  - [ ] Owner can lower the penalty (down to R0) while the termination is
        pending or accepted and the penalty is not yet paid, with a required
        reason (e.g. "replacement tenant from 1 Feb").
  - [ ] The penalty is computed server-side; nobody can set it above
        min(2, months remaining) × monthly rent; the tenant can never set or
        change it (database guard).
  - [ ] Tenant sees the new amount and the reason, and is notified.
  - [ ] Each change recorded (old amount, new amount, reason, who, when).
  - [ ] Tests: owner lowers R11 000 → R5 500 and tenant sees R5 500; tenant
        REST update of the penalty rejected; owner raising above the cap
        rejected.

## CT7-041 🔴 Move-out inspection isn't created when a lease ends early

- **Role:** owner + tenant · **Area:** inspections, early termination
- **Today:** `acceptTermination` (`leaseTermination.api.ts:166-185`) creates
  no inspection; a move-out inspection exists only if the owner creates one
  by hand (`inspectionsApi.ts:663`). RHA s5(3)(e) requires a joint inspection
  with the tenant within 3 days before the tenant vacates.
- **Acceptance criteria:**
  - [ ] Accepting an early termination (and any lease end) creates one
        move-out inspection for that lease, scheduled within the 3 days
        before the move-out date, linked to the move-in inspection.
  - [ ] Owner and tenant are both notified and see it in their inspections.
  - [ ] Created server-side so every way a lease ends is covered; at most
        one per lease.
  - [ ] Test: accept termination → exactly one move-out inspection exists
        with a date in the 3 days before move-out.

## CT7-042 🔴 Deposit can be refunded before the move-out inspection (needs interlock)

- **Role:** owner + tenant · **Area:** deposit refund, inspections
- **Today:** accepting the termination starts a refund in
  `pending_inspection` (`OwnerEarlyTerminationScreen.tsx:114-117` →
  `depositRefund.api.ts:44-63`), but nothing enforces it:
  `processRefund` (`depositRefund.api.ts:126-144`) records the refund as
  done without any inspection check, so the deposit showed as returned in
  full before the move-out inspection. Damage found later can then no longer be deducted.
- **Expected (Navin's example):** deposit R5 500; the inspection finds R1 000
  of damage that is the tenant's cost → R4 500 is refunded.
- **Acceptance criteria:**
  - [ ] Refund can't be processed until the move-out inspection is
        completed and signed — or the tenant failed to attend (see below) —
        enforced in the database, not just the UI.
  - [ ] The lock can never hold the deposit indefinitely: if the owner
        hasn't arranged the inspection by the lease end date, the full
        deposit + interest becomes refundable (RHA s5(3)), and the owner is
        reminded before that happens. Test for this case.
  - [ ] Each issue on the move-out inspection is marked **owner's cost**
        (fair wear and tear) or **tenant's cost** (damage), with an amount.
  - [ ] Tenant's-cost items become deposit deductions automatically; refund
        = deposit + interest − tenant's-cost deductions, with an itemised
        statement for the tenant.
  - [ ] RHA s5(3) deadlines shown and tracked from lease end:
        no deductions → refund within 7 days; deductions → balance within
        14 days of restoration; tenant didn't attend the inspection → owner
        inspects within 7 days and refunds the balance within 21 days;
        owner didn't arrange the inspection → full refund (no deductions).
  - [ ] Tenant can dispute a deduction; a disputed amount isn't paid out to
        the owner until the dispute is resolved.
  - [ ] Tests: `processRefund` before the inspection is signed is rejected;
        R5 500 deposit (zero interest) with an R1 000 tenant's-cost item refunds
        R4 500;
        an owner's-cost item doesn't reduce the refund.

## Client test of build 11 — lease signing (2026-11-17)

Navin (96 De Waal): paid the holding deposit, created and edited the lease,
then neither the owner nor the tenant could sign.

## CT7-043 🔴 Nobody can sign a lease on Android ✅ (PR #249)

- **Role:** owner + tenant · **Platform:** Android · **Screen:** Sign Lease Agreement
- **Today:** the signature modal used React Native's `SafeAreaView`, which pads
  only on iOS. With edge-to-edge on Android the **Clear / Confirm Signature**
  buttons sat under the system navigation bar; taps went to the OS (recents),
  so no signature was ever saved. Inspection signatures use the same modal.
  The edited clause was unrelated. Build 11 shipped with signing verified only
  on the iOS simulator.
- **Acceptance criteria:**
  - [x] Signature modal pads by the device's safe-area insets.
  - [x] Jest regression test (fails without the fix).
  - [x] Android Maestro guard `android-lease-sign-guard.yaml`: tenant signs,
        owner signs, lease goes active — passed on the emulator with the
        release APK.

## CT7-044 🟠 Signature date runs off the screen; signature images blank ✅ (PR #249)

- **Role:** owner + tenant · **Platform:** Android · **Screen:** My Lease / Lease Details
- **Today:** "Signed <date>" ran off the right edge on the tenant's My Lease
  (the tenant's copy of the signature row had lost `flex: 1`), and both
  screens showed empty signature boxes (private `signatures` bucket read via
  its public URL).
- **Acceptance criteria:**
  - [x] One shared `LeaseSignatureRow` for owner and tenant; date stays on screen.
  - [x] Thumbnails load through a short-lived signed URL.
  - [x] Jest test for both; verified on the Android emulator.

## CT7-045 🟠 Other screens slide under the Android system bars ✅ (PR #249)

- **Role:** all · **Platform:** Android
- **Today:** six more files used React Native's `SafeAreaView` (no-op on
  Android): shared `ModalSheet`, vendor-payment list / invoice / checkout /
  result, POPIA data-rights.
- **Acceptance criteria:**
  - [x] All moved to `react-native-safe-area-context`.
  - [x] ESLint error on importing `SafeAreaView` from `react-native`, so
        pre-commit and CI block the pattern.

## CT7-046 🟠 Bottom sheets and owner modals: last button under the Android nav bar (PR #251)

- **Role:** all · **Platform:** Android · Found by the SA review of PR #249.
- **Today:** 14 bottom sheets (EFT payment confirm, arrears plan, early
  termination, lease review, payment-dispute accept/reject, viewing actions,
  POPIA consent, property tax, vendor documents/services, shared `Select` and
  `DateField`) and 5 full-screen owner modals (holding deposit, lease renewal
  offer, deposit deduction, insurance document / policy picker) drew their
  last row under the Android navigation bar — same class as CT7-043.
- **Acceptance criteria:**
  - [x] Bottom sheets pad the white sheet by the bottom inset; full-screen
        modals use `edges={['top', 'bottom']}`.
  - [x] Signature thumbnails re-sign when a link expires; never fall back to
        the unloadable public URL.
  - [x] `scripts/run-android-guards.sh` runs every Android guard (3-button
        navigation) — release gate step 4.
  - [x] Jest: `Select` bottom inset, `LeaseSignatureRow` expiry/failure.
  - [ ] Each sheet visually checked on the Android emulator (release APK).

## CT7-048 🟠 Bottom tab labels under the Android navigation buttons (all roles)

- **Role:** owner, tenant, vendor · **Platform:** Android (3-button navigation)
  · Found in the Android lifecycle run (lc06 / lc08 screenshots).
- **Today:** the owner, tenant and vendor tab bars had a fixed height 85 and
  bottom padding 25. With edge-to-edge and 3-button navigation the inset is
  ~48dp, so the labels (Home, Search, Payments, …) sat under the system
  Back/Home/Recents buttons. `tenant-tabbar-guard` only checks that the labels
  exist, so it passed.
- **Acceptance criteria:**
  - [x] Shared `useTabBarStyle()` sizes the bar from the device's bottom inset
        (min 25, so devices without an inset are unchanged); all three layouts use it.
  - [x] Jest: 48dp inset → padding 48 / height 108; no inset → 85/25; each
        layout uses the hook and has no fixed `height: 85`.
  - [x] Owner, tenant and vendor tab bars visually checked on the Android
        emulator (release APK, 3-button navigation).

## Android walkthrough of build 11 fixes (2026-11-18)

Found while testing on the Android emulator with a real on-screen keyboard.

## CT7-047 🟠 Keyboard covers the fields and buttons of pop-up forms (Android) (PR #252)

- **Role:** all · **Platform:** Android
- **Today:** an RN `<Modal>` window does not resize for the keyboard on
  Android, and 11 pop-up forms had no keyboard handling. While typing, the
  keyboard hid their lower fields and their buttons — e.g. vendor _Add
  Service_: Base Price, Pricing Unit and the Add button were unreachable
  until the keyboard was closed. Also: vendor _Add Service Area_, PO
  accept/decline notes; owner holding-deposit request, deposit deduction,
  lease renewal offer, insurance document, invoice approve/reject; tenant
  EFT payment confirm, invoice approve/reject.
- **Acceptance criteria:**
  - [x] Every modal with a text input wraps its content in
        `KeyboardAvoidingView` (`padding` iOS / `height` Android); its
        ScrollViews use `keyboardShouldPersistTaps="handled"`.
  - [x] Jest guard `modalKeyboardGuard.test.ts` fails for any modal with a
        TextInput and no keyboard handling.
  - [x] Android emulator (release APK, real keyboard): typing in the lowest
        field keeps it and the action buttons visible, first tap works —
        `android-keyboard-forms-guard` green (in `run-android-guards.sh`);
        lifecycle 01→05 green.

## CT7-050 🟠 Tenant "Add Comment" stays under the keyboard (inspection report)

- **Role:** tenant · **Platform:** Android · Found in the Android lifecycle run
  (lifecycle-06, LC-6-14a: `inspection-tenant-comment-add` not found after typing).
- **Today:** on the move-in inspection report the tenant types a comment and
  the keyboard covers the "Add Comment" button. Android (adjustResize) only
  scrolls the focused input into view, and the button sits below it, so the
  tenant has to close the keyboard before they can post.
- **Acceptance criteria:**
  - [x] Shared `useRevealAboveKeyboard()`: when the keyboard opens while the
        comment box is focused, the input + button block scrolls fully above it.
  - [x] Jest: `revealOffset` maths; InspectionScreen wires the hook to the
        comment input, the block and the ScrollView.
  - [x] Visually checked on the Android emulator (release APK): button visible
        with the keyboard up; lifecycle-06 posts a comment with one tap
        (both LC-comments posted; owner inspection steps green).

## CT7-070 🟡 lifecycle-03a failed on a hidden status label, not an app bug (test) — fixed

- **Role:** tenant · **Platform:** Android · Found in the build 12 release gate
  (2026-11-20, main c15ca10).
- **Today:** the application was submitted (DB `submitted` at 11:51, the
  failure time), but the flow asserted "Submitted" on whatever was on screen.
  The test account now has 29 (withdrawn) applications from fixture resets;
  scrolling to the property title left the new card's status label under the
  header. 03a stopped before the owner requested the holding deposit, so
  04 → 08 failed in cascade.
- **Acceptance criteria:**
  - [x] 03a scrolls up to the "Submitted" label and down to Withdraw before
        asserting them.
  - [x] Full lifecycle 01 → 08 green from a clean fixture with the fix
        (2026-11-20, 13/13, build 12 APK from main c15ca10).

## CT7-069 🟠 First PDF print after the app starts hangs; export ended with "Failed to generate" after ~45 s (all roles) — fixed

- **Role:** all · **Platform:** Android · Found on the PR #268 device check
  (2026-11-20 06:11): 7 of 8 back-to-back exports saved; the first one after
  install failed about 55 s after the tap (CT7-068's 45 s print limit; the
  log then showed only "API error", so this is inferred from timing).
- **This change (diagnostics):** export failures are logged as
  `<name>: <message>` from the sanitized error; `printHtmlToFile` logs each
  print's duration and, for a print abandoned at the time limit, when (or
  whether) it answered later; `exportInspectionReportPdf` logs load+embed,
  print and upload times, photo count and HTML size. No user data is logged.
- **Found with the logs (emulator, 2026-11-20 06:21–06:31, 16 exports):**
  a print either finished in 0.4–1.3 s or never answered (no late result
  after 2+ min). All 6 hangs were the first print in a fresh app process
  (5 of 8 fresh launches, plus the first export after install); every later
  print in the same process worked, including right after a hang. Load+embed
  took 3–10 s (11 photos, 1.1 MB HTML) and upload 0.5–1.6 s, and neither ever failed.
- **Fix:** `printHtmlToFile` waits 15 s (was 45 s) and retries a print that
  didn't answer once. expo-print can't cancel the stuck render, so at most
  one abandoned WebView is left per export; its file is deleted if it ever
  answers. Device check of that (24 exports, 16 fresh launches): 23 saved;
  the failure was a stuck print then two ERR_PDF_WRITE 40 ms apart, all right
  after app start. Failed prints are now retried after 1 s, 2 s, 3 s (4
  attempts in all).
  Next 24: 23 saved; the failure was both attempts stuck in a fresh process.
  Across 48 device exports every failed or stuck print was the first print in
  its app process. Both inspection screens now call `warmUpPrinter()` on
  mount: one blank background print per process (file deleted, failures
  ignored), so the user's report is never the first print.
  With the warm-up (APK from a1e0c82; Android code identical to the merged
  da89732): 24 of 24 exports saved, 16 of them right after a fresh app
  launch and 8 back-to-back. The print step still failed 14 times
  (ERR_PDF_WRITE), all absorbed by the warm-up or recovered by a retry.
- **Acceptance criteria:**
  - [x] Logging of the failing step, without user data (Jest).
  - [x] Cause identified from device logs and fixed, with a regression test
        (stuck first print → retried → saved).
  - [x] Android emulator: about 20 exports in a row, including fresh launches,
        all saved (2026-11-20: 24/24, 16 fresh launches). The underlying
        WebView print failure is worked around, not removed.

## CT7-068 🟠 Server requests could hang forever; inspection report export failed without saying why (all roles) — fixed

- **Role:** all · **Platform:** Android · Found in the build-12 lifecycle run,
  2026-11-20 03:58 (phase 06: tenant's second "Export Report" showed "Failed
  to generate inspection report"; the first export a few seconds earlier
  saved). The network probe was clean, no file reached storage, and the
  export's `catch {}` discarded the error, so the failing step is unknown.
  Not reproduced in 4 back-to-back exports. Same class as the earlier stuck
  Approve/property spinners: React Native's Android fetch has no timeout.
- **Fix:** every Supabase request goes through `createFetchWithTimeout`
  (`src/lib/fetchWithTimeout.ts`): 30 s for database/auth, 120 s for storage
  reads and edge functions, no limit for file uploads (no progress events,
  so a slow 50 MB video can't be told from a stall); a stalled request fails
  with "Request timed out" (which sign-in already shows as "Can't reach
  Lalarente"). Both inspection export handlers (tenant `InspectionScreen`,
  owner `OwnerInspectionDetailScreen`) now report the error to Sentry and
  log it; the export keeps the database error instead of replacing it, and
  Sentry classifies timeouts as "request timed out" (no user text).
- **Root cause (found with the new logging on the device check):** expo-print
  renders the PDF in a hidden Android WebView; Chromium logged "Printing
  failed." and the export rejected with `ERR_PDF_WRITE`. In another try the
  print never called back and the export spinner ran past 150 s. All report
  exports (`pdfReports.ts`) now use `printHtmlToFile`
  (`src/shared/utils/printToPdf.ts`): each attempt limited to 45 s; a failed print is
  retried up to 3 times, a timed-out one is not (expo-print can't cancel the
  render) and its late file is deleted. Sentry forwards expo-print's own error
  codes (allow-list, e.g. `ERR_PDF_WRITE`).
- **Acceptance criteria:**
  - [x] A failed or hung WebView print is retried and never hangs (Jest).
  - [x] A stalled request fails after its limit instead of hanging (Jest).
  - [x] Caller aborts still work; normal responses pass through (Jest).
  - [x] Export failures are reported and logged in both screens (Jest guard).
  - [ ] Android emulator: full lifecycle 01 → 08 passes on the new APK.

## CT7-067 🟠 Tenant dashboard once showed "Welcome back, Tenant" with no home or activity right after sign-in (tenant) — investigating

- **Role:** tenant · **Platform:** Android · Found in the build-12 lifecycle
  run, 2026-11-20 02:40 (phase 08, owner signed out → tenant signed in).
- **Seen:** the dashboard header said "Tenant" (no name), no 2B Datura card,
  "No recent activity", although the lease was `active`. The dashboard
  query completed in 342 ms; the displayed data was empty. The profile read's
  error is discarded (`useTenantDashboard.ts`), so a failed profile read also
  shows "Tenant". A missing tenant session / RLS filtering is an unconfirmed
  hypothesis.
- **Not reproduced:** 4 owner → tenant sign-in switches on the same APK all
  showed the tenant's name and data.
- **Acceptance criteria:**
  - [ ] Root cause found (session not yet attached when the first dashboard
        query runs, or another cause) and fixed.
  - [ ] Regression test that fails without the fix.
  - [ ] Android emulator: repeated sign-out → sign-in shows the tenant's own
        dashboard every time.

## CT7-062 🟡 Viewing times show seconds: "10:00:00", "2026/11/19, 03:05:01" (owner, tenant)

- **Role:** owner, tenant · **Platform:** all · Found in the Android walkthrough.
- **Today:** viewing times were rendered straight from the database
  ("10:00:00") and viewing timelines used a default date-time with seconds.
- **Acceptance criteria:**
  - [x] Shared `formatTime()` → "10:00"; viewing lists, details, timelines,
        dashboard card, reminders and notifications use it; date-times read
        "19 Nov 2026, 03:05".
  - [x] Jest `viewingTimeFormat.test.ts` (fails on main: 7 files).
  - [x] Android emulator (release APK), 2026-11-19: Viewing Requests "Requested: Fri, 20 Nov at 10:00", "Requested 19 Nov 2026" (was "2026/11/19"); tenant My Viewings same. All 36 `toLocaleDateString('en-ZA')` dates (yyyy/mm/dd) now formatDate; guard extended.

## CT7-063 🟠 Dashboard "In Arrears" and Rent Roll's Overdue card disagree with Rent Roll (owner)

- **Role:** owner · **Platform:** all · Follow-up to CT7-057.
- **Today:** the dashboard In Arrears amount / Tenants In Arrears and Rent
  Roll's header Overdue card counted any pending row due before "now":
  deposits, rent due today, a previous tenant's rows, un-rented properties,
  while missing failed and part-paid rent. Test fixture: R 29,500 / 4 (header 5) where Rent Roll's badges show R 9,500 / 2.
- **Acceptance criteria:**
  - [x] Dashboard and Rent Roll header use `summarizeArrears` (built on
        `summarizeRent`, the rule behind the Rent Roll badges).
  - [x] Jest `dashboardArrears.test.ts` + `RentRollOverdueHeader.test.tsx`
        on one shared fixture (fail on main).
  - [x] Android emulator (release APK), 2026-11-19: dashboard In Arrears R 0 and Rent Roll Overdue card 0 agree with the Rent Roll badges.

## CT7-064 🟠 Opening Notifications marks every notification read (all roles)

- **Role:** all · **Platform:** all · Product decision 2026-11-19: only a
  notification the user taps should disappear.
- **Today:** opening the screen marked all unread notifications read, and the
  list shows unread ones, so everything vanished after one visit.
- **Acceptance criteria:**
  - [x] Nothing is marked read on open; tapping a row marks only the
        notification(s) behind it; a stand-alone notification leaves the
        list, the rest stay and keep the bell count.
  - [x] Stand-alone rows open what they are about (viewing, job, lease,
        payments); tenant now lists them too.
  - [x] Jest `unreadNotifications.test.ts` (guard fails on main, all three
        screens).
  - [x] Android emulator (release APK), 2026-11-19: owner opens Notifications → unread count unchanged (16 → 16); tenant taps "Viewing Completed" → opens the viewing, back: only that row gone, others stay (unread 56 → 55).

## CT7-065 🟡 Property Type is free text pre-filled "apartment" (owner)

- **Role:** owner, tenant · **Platform:** all · Found in the Android walkthrough.
- **Acceptance criteria:**
  - [x] Add / Edit Property: single-select chips Apartment, House, Townhouse,
        Cottage, Room (stored lower-case; an existing unknown value is kept
        as its own chip).
  - [x] Property detail (owner, tenant) shows the label; tenant search can
        filter on every type.
  - [x] Jest `PropertyTypePicker.test.tsx` (fails on main).
  - [x] Android emulator (release APK), 2026-11-19: Edit Property shows the chips with the stored "Townhouse" selected and Save disabled (no change); property detail Type "Townhouse"; not saved.

## CT7-066 🟠 Tenant can report an issue without a signed lease (tenant)

- **Role:** tenant · **Platform:** all · Product decision 2026-11-19: issues
  are between owner and tenant, so reporting needs a lease.
- **Acceptance criteria:**
  - [x] Report Issue only with a lease signed by both and in effect
        (`active`, `month_to_month`, `renewal_pending`): list "+" / "Report an
        Issue", report screen (also by link) and vendor directory "Use on new
        report"; otherwise "You can report issues once your lease is signed by
        you and the owner."
  - [x] Jest `leaseInEffect.test.ts` + `reportIssueLeaseGate.test.tsx` (fail
        on main).
  - [x] Android emulator (release APK), 2026-11-19: tenant with an active lease sees Report Issue (+); unsigned-lease refusal covered by Jest (no unsigned fixture on device).
  - [ ] Follow-up: enforce the same rule in the database (RLS on
        `maintenance_requests` insert) via a migration.

## CT7-061 🟡 Vendor "View My Jobs" opens "Failed to load job details" (vendor)

- **Role:** vendor · **Platform:** all · Found in the Android walkthrough
  (vendor → New Message → "Use Job Threads" → View My Jobs).
- **Today:** the button went to `/(vendor)/jobs/index`. expo-router matched
  that URL to `jobs/[id]` with id "index", so the vendor saw an error alert
  instead of their jobs. The post-send destination for vendors had the same
  path.
- **Acceptance criteria:**
  - [x] Both go to `/(vendor)/jobs` (the My Jobs list).
  - [x] Jest guard `routeIndexSegment.test.ts`: no route literal in `src` or
        `app` ends in `/index` (fails on main at both lines).
  - [x] Android emulator (release APK), 2026-11-19: New Message → View My
        Jobs opens the My Jobs list (no error alert).

## CT7-060 🟡 Dates follow the phone's language: "Due: 12/1/2026" (all roles)

- **Role:** all · **Platform:** all · Found in the Android walkthrough
  (tenant → Payments → Payment History, and owner → Rent Roll "Next due").
- **Today:** 46 places formatted dates with a bare `toLocaleDateString()` /
  `toLocaleString()`, so the format follows the phone's language. On an
  English (US) phone the first rent showed "Due: 12/1/2026", which a South
  African reads as 12 January, while the dashboard showed "2026/12/01".
- **Acceptance criteria:**
  - [x] Every such date (17 screens/components: leases, payments, rent roll,
        tenants, applications, quotes, maintenance timeline, compliance,
        vendor documents and jobs) uses the shared `formatDate()` →
        "1 Dec 2026" (date-time: "1 Dec 2026, 14:30").
  - [x] Jest guard `dateLocale.test.ts`: no bare `toLocaleDateString()` /
        `toLocaleTimeString()` / `new Date(…).toLocaleString()` in `src` or
        `app` (fails on main: 18 files).
  - [x] Android emulator (release APK), 2026-11-19: tenant Payments "Due: 01
        Dec 2026"; owner Rent Roll "Next due: 01 Dec 2026"; Tenants & Leases
        "01 Dec 2026 → 30 Nov 2027" (main: 12/1/2026).

## CT7-058 🟡 Property search with no match says "No properties yet" (owner)

- **Role:** owner · **Platform:** all · Found in the Android walkthrough
  (My Properties → search "zzz-no-such-property").
- **Today:** the list's empty state was always "No properties yet — Add your
  first property", even for an owner with four properties whose search or
  status filter matched none.
- **Acceptance criteria:**
  - [x] With properties hidden by the search / filter: "No properties match"
        and a **Clear filters** button; "No properties yet" only for an owner
        with no properties.
  - [x] Jest `PropertiesListEmptyState.test.tsx` (fails without the fix).
  - [x] Android emulator (release APK), 2026-11-19: search "zzqx-nomatch" →
        "No properties match" + Clear filters → full list back.

## CT7-059 🟡 Raw values with underscores on screen ("Prepaid Water_electricity", "Bbq")

- **Role:** owner, tenant · **Platform:** all · Found in the Android
  walkthrough (Add Property: selected services / amenities chips).
- **Today:** labels were built with `value.replace('_', ' ')`, which replaces
  only the first underscore, then title-cased: "Prepaid Water_electricity",
  "Bbq". Same pattern on application status, compliance risk level, lease
  type, tenant maintenance empty text and the inspection-issue description.
- **Acceptance criteria:**
  - [x] Add / Edit Property chips use the option's own label
        (`optionLabel`): "Prepaid Water/Electricity", "BBQ"; custom entries
        formatted with every underscore replaced.
  - [x] The other sites replace every underscore.
  - [x] Jest `optionLabel.test.ts` + guard: no string-pattern `.replace('_', …)`
        anywhere in `src/` or `app/` (fails without the fix).
  - [x] Android emulator (release APK), 2026-11-19: Edit Property (same chip
        code as Add) → tick BBQ and Prepaid Water/Electricity → chips read
        "BBQ" and "Prepaid Water/Electricity" (main: "Bbq",
        "Prepaid Water_electricity"); not saved.

## CT7-057 🟠 Rent Roll says "Paid" for rent that was never paid (owner)

- **Role:** owner · **Platform:** all · Found in the Android walkthrough
  (owner dashboard → Rent Roll): 2B Datura showed **Paid** while Invoices
  ("Total Collected R 0,00") and Tax Reports ("0 payments") agreed nothing was
  collected — its only payment is pending, due 1 Dec. The badge also showed
  the raw value "No_lease".
- **Today:** a rented property was "paid" whenever its next payment was more
  than five days away, or when it had no payments, without checking that any
  payment was ever completed.
- **Acceptance criteria:**
  - [x] `summarizeRent()` (pure; status, next due, overdue amount): rent rows
        of the active lease only; unpaid = pending, failed or completed with an
        outstanding balance (partial); "Paid" only when the latest rent that
        has fallen due is settled; nothing due yet → new **Upcoming** status
        (own colour, icon and filter chip); within five days → "Due soon";
        due dates compared as South African calendar dates (SA #262).
  - [x] Filter chips scroll sideways (six chips overflow a phone width).
  - [x] Badge and filter chips show labels ("No lease", "Due soon"), not raw
        values.
  - [x] Jest `rentRollStatus.test.ts`: each status incl. the 2B Datura case,
        labels, and a guard that the screen uses them (fails on main).
  - [x] Android emulator (release APK), 2026-11-19: Rent Roll shows 2B Datura
        as **Upcoming** (next due 12/1/2026), Dolphin and 96 De Waal as "No
        lease"; chips readable and scroll sideways (a first build clipped the
        labels: chip row now `flexShrink: 0`); Upcoming filter lists only
        2B Datura.
  - [ ] Follow-up (separate): owner dashboard "In Arrears" and analytics still
        compare dates as timestamps and ignore failed / partial rows
        (`ownerDashboardApi.ts`) — move them onto `summarizeRent`.

## CT7-056 🟡 Owner dashboard Recent Activity rows do nothing when tapped (owner)

- **Role:** owner · **Platform:** all · Found in the full walkthrough (code
  review of the dashboard).
- **Today:** each Recent Activity row (rent received, arrears, new maintenance,
  new application, viewing events) and the "View All" link are animated
  buttons with no `onPress`: they react to a tap and go nowhere. There is no
  full activity screen for "View All" to open.
- **Acceptance criteria:**
  - [x] Every feed item carries a `route` (required in the type): rent → Rent
        Roll, arrears → Arrears, maintenance / application / viewing → its
        detail screen. Tapping a row opens it.
  - [x] Dead "View All" removed.
  - [x] Dashboard cache key versioned (`v2`), so a payload cached before the
        change (activities without `route`) is never painted; sign-out still
        clears old keys (SA #261). Jest `dashboardCache.test.ts` and
        `buildActivityFeed.test.ts` (each category → its record id).
  - [x] Jest `ActivitySection.test.tsx`: rows navigate, no View All (fails
        without the fix).
  - [x] Android emulator (release APK), 2026-11-19: Recent Activity shows no
        "View All"; tapping "New Application · 2B Datura" opens its
        Application Details.

## CT7-055 🟡 Back from a maintenance request loops back to it (owner)

- **Role:** owner · **Platform:** all (seen on Android) · Found in the full
  walkthrough; reproduced on the emulator: Maintenance → request → ← →
  list → Android Back → **the same request again** → Back → dashboard.
- **Today:** the header back arrow pushed the maintenance list whenever there
  was history, adding a new entry instead of going back; with no history
  (opened from a link) it called `back()`, which goes nowhere.
- **Acceptance criteria:**
  - [x] The arrow goes back like Android Back; with no history (opened cold
        from a notification) it resets the tabs to the maintenance list —
        `replace` / `navigate` would keep the request in tab history (SA #260).
        Shared `useGoBackOr('maintenance')`, also on the tenant and vendor
        request details (header, not-found, after delete).
  - [x] Jest: `useGoBackOr.test.ts` drives the real React Navigation
        `TabRouter` (navigate-to-list loops back, reset does not, list →
        detail → back → back leaves Maintenance) + guard on the three detail
        screens; `OwnerMaintenanceDetailBack.test.tsx` renders the owner
        screen (fails without the fix).
  - [x] Android emulator (release APK), 2026-11-19: Maintenance → request → ←
        → list → Back goes to the dashboard (no loop back into the request).
  - [x] Android emulator: request opened cold by link → ← → maintenance list
        → Back leaves the app to the caller (does not reopen the request).

## CT7-054 🟡 Vendor can't open the quote they submitted (vendor)

- **Role:** vendor · **Platform:** all · Found in the full walkthrough (code
  review of the vendor job screen).
- **Today:** the job screen shows only the quote's status and total. The quote
  detail screen (line items, terms) has a route, and the job screen has a
  `handleViewQuote` handler and button styles for it, but no button was ever
  rendered, so nothing in the app led there.
- **Acceptance criteria:**
  - [x] "View Quote" button on the job's My Quote card (every quote status)
        opens `/(vendor)/maintenance/<id>/quote/<quoteId>`.
  - [x] Jest `VendorJobViewQuote.test.tsx`: button shown and routes for
        submitted / approved / rejected / revision requested; absent with no
        quote (fails without the fix).
  - [x] The quote detail screen never loaded the submitted line items (only
        subtotal / VAT / total; SA #259): it now lists each line with
        quantity × unit price and amount (`getQuoteLines`). Jest
        `VendorQuoteDetailLines.test.tsx` for every quote status (fails
        without the fix).
  - [x] Android emulator (release APK), 2026-11-19: vendor job → View Quote
        opens Quote Details with the line item (11 × R 500 = R 5,500, matching
        the subtotal), cost breakdown, revision and notes.

## CT7-053 🟠 Android alerts lose every button after the third (all roles)

- **Role:** all · **Platform:** Android · Found in the full walkthrough
  (owner maintenance code review), confirmed in React Native's `Alert.js`:
  Android keeps `buttons.slice(0, 3)` and the dialog is not cancelable.
- **Today:** six dialogs had more than three buttons, so on Android:
  - owner **Push to Vendors**: "Dedicated Vendors" missing;
  - document **Extend Retention**: "5 Years" missing;
  - tenant **Profile → Country Code**: only +27 / +263 / +267, no UK, USA,
    India, no Cancel;
  - tenant **Documents upload** and **Profile → proof of address** source
    pickers: no Cancel (user forced to pick a source);
  - **Vendor directory → Invite** with three open jobs: no Cancel.
- **Acceptance criteria:**
  - [x] `showChoices` (same arguments as `Alert.alert`): on Android with more
        than three buttons, a bottom sheet lists them all; Back / backdrop /
        Cancel run the cancel button. iOS and ≤ 3 buttons unchanged.
  - [x] The six dialogs use it; the host is mounted in the root layout.
  - [x] Jest `ChoiceSheet.test.tsx`: all four Push to Vendors choices shown and
        runnable, cancel on Back, native alert kept for ≤ 3 and on iOS.
  - [x] Jest guard `androidAlertButtons.test.ts`: no `Alert.alert` with more
        than three buttons, buttons must be countable (fails on the old code).
  - [x] Android emulator (release APK), 2026-11-19: Country Code sheet lists
        all six codes + Cancel and picking +44 applies; proof-of-address
        picker shows all three sources + Cancel, and Cancel and Back close it.
        Push to Vendors uses the same sheet path (Jest covers its 4 choices).

## CT7-052 🟠 Active lease left without its PDF, owner told "activated!" (owner)

- **Role:** owner · **Platform:** all · Found in the Android lifecycle run
  (lifecycle-05: both signed, lease active, no `lease_document_url`; owner
  saw the fallback "Generate PDF" button instead of "Download PDF").
- **Today:** the PDF is generated on the owner's phone right after the second
  signature. One failure (e.g. the just-uploaded signature image not readable
  yet) was logged and swallowed; the lease activated without a PDF and the
  owner still saw "Lease agreement signed and activated!". Evidence: no
  `contracts/<lease>/signed-lease.pdf` object for lease 25349598…, while the
  five earlier fixture leases that day each have one.
- **Acceptance criteria:**
  - [x] PDF generation is retried (2 attempts, 1.5 s apart; the upload retries
        network errors itself); temp-file cleanup can't fail it; each failure is
        reported to Sentry.
  - [x] `executeLease` returns `pdfGenerated`; when false (or the URL could not
        be saved) the owner is told to tap "Generate PDF".
  - [x] Jest: retry succeeds on a later attempt, gives up after both attempts
        and reports each; the signing alert uses the flag.
  - [x] Android lifecycle-05 green (Download PDF shown after signing):
        emulator run 2026-11-19 (lifecycle-20261119-030736) — lease activated,
        no "Generate PDF" fallback, Download PDF on owner and tenant.

## CT7-051 🟠 Keyboard covers the lower part of full-screen forms (Android, all roles)

- **Role:** all · **Platform:** Android · Found in the Android lifecycle run
  (lifecycle-07: tenant _Report Issue_ — description field hidden under the
  keyboard after typing the title). Same root cause as CT7-050.
- **Today:** Android draws edge-to-edge (targetSdk 35+), so the window is no
  longer resized for the keyboard. The shared `KeyboardAvoidingView` (26
  screens) and 7 screens using React Native's directly had no Android
  behavior, so the lower fields and buttons of those forms stayed under the
  keyboard: report issue, chat thread, compose message, tenant application,
  closure / mediation, vendor invoice, banking, progress update, add/edit
  property, lease create, early termination, documents upload, profile edits…
- **Acceptance criteria:**
  - [x] Shared `KeyboardAvoidingView` defaults to `height` on Android
        (`padding` on iOS unchanged); the 7 direct uses set `height` too.
  - [x] 16 form screens that rendered no KeyboardAvoidingView at all (Report
        Issue, report maintenance, schedule inspection, PO detail / send PO,
        owner + tenant profile, data-subject rights, early termination, lease
        renewal, payment dispute, request viewing, verification, vendor quote
        detail / submit, search filters) now wrap header, form and footer.
  - [x] 5 screens whose KAV closed before the submit footer now enclose it.
  - [x] Jest `androidKeyboardBehavior.test.tsx`: shared default on Android and
        iOS, caller override; no `KeyboardAvoidingView` in the app is iOS-only;
        every screen with an input outside a modal renders one (allowlist for
        top-only search bars); Report Issue wraps description + submit.
  - [x] Device run 2026-11-19 caught a regression of the first fix: the KAV
        shrank the form but the ScrollView kept its offset, so the field being
        typed in went out of view (Report Issue: Issue Title). Fixed with the
        shared `KeyboardAwareScrollView` (scrolls the focused input above the
        keyboard after the shrink), used by every vertical ScrollView in a
        file with a KAV; Jest behaviour test + guard (fails on the old screen).
  - [x] lifecycle-07 asserts the title / description field and Submit stay
        visible with the keyboard up.
  - [x] Android emulator (release APK): Report Issue, chat thread and a long
        form keep the field being typed in and the buttons reachable; lifecycle 01→08 green.

## CT7-049 🟡 Status-bar clock, battery and signal invisible on Android

- **Role:** all · **Platform:** Android · Found in the CT7-048 emulator check.
- **Today:** with edge-to-edge the status bar is transparent, the Android theme
  doesn't request dark icons and the app set no `StatusBar` style, so the
  white icons disappeared on the app's white screens.
- **Acceptance criteria:**
  - [x] Root layout renders `<StatusBar style="dark" />` (expo-status-bar).
  - [x] Jest: the root layout keeps the dark status bar.
  - [x] Clock/battery visible on owner, tenant and vendor screens on the
        Android emulator (release APK), 2026-11-19, in system light and dark
        mode: dark icons on the app's light screens, light icons on the dark
        3D tour, dark again after leaving it.
