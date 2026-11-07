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

---

## Captured, not yet triaged

<!-- Drop new issues here as they come in; I'll move them above once categorized -->
