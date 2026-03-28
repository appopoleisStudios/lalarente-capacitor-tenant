# Lalarente App — QA Bug Tracker

**Last Updated:** 2026-03-27
**Version Under Test:** Build 1.0.3 / feature/production-flows-implementation
**Testing Method:** Manual

---

## Bug Status Legend

| Status | Meaning |
|--------|---------|
| 🔴 Open | Not yet fixed |
| 🟡 In Progress | Fix being worked on |
| 🟢 Fixed | Fix committed, needs re-test |
| ✅ Verified | Confirmed fixed on device |
| ⛔ Blocked | Depends on another bug being fixed first |

## Priority Legend

| Priority | Meaning |
|----------|---------|
| P0 | Blocker — core flow completely broken |
| P1 | Critical — major feature unusable |
| P2 | High — feature works with workaround |
| P3 | Medium — UX issue, minor data issue |
| P4 | Low — cosmetic / polish |

---

## Owner Bugs

| ID | Priority | Status | Description | Steps to Reproduce | Expected | Actual | Notes |
|----|----------|--------|-------------|-------------------|----------|--------|-------|
| OWN-001 | P0 | 🟢 Fixed | Cannot add a property | 1. Login as owner<br>2. Go to Properties<br>3. Tap "Add Property"<br>4. Fill in details and submit | Property created and visible in list | Fails / crashes / no response | Root cause: (1) session not persisted — fixed via AsyncStorage in supabase.ts; (2) createProperty insert was missing size_sqm, available_from, min_lease, pets, smoking, lat/lng — all added |
| OWN-002 | P2 | 🟢 Fixed | Profile name not displaying correctly | 1. Login as owner<br>2. Open Profile | Full name shown matches what was entered during registration | Name shown is wrong or missing | ProfileScreen was a hardcoded placeholder — rewritten to load real data from Supabase |
| OWN-003 | P1 | 🟢 Fixed | Cannot edit profile | 1. Login as owner<br>2. Open Profile<br>3. Tap Edit / change a field<br>4. Tap Save | Profile updated successfully, new values persisted | Save fails or changes not saved | ProfileScreen now has inline edit for name + phone, saves to profiles table |
| OWN-004 | P1 | 🟢 Fixed | Notifications section inaccessible | 1. Login as owner<br>2. Tap bell icon or Notifications menu | Notifications screen opens | Crashes, blank screen, or navigation error | ProfileScreen Notifications button had no onPress — now routes to /(owner)/notifications |
| OWN-005 | P0 | ⛔ Blocked | All other owner flows broken | — | Can manage leases, maintenance, viewings etc. | Everything requires at least one property | Blocked by OWN-001 (now fixed — re-test) |

---

## Tenant Bugs

| ID | Priority | Status | Description | Steps to Reproduce | Expected | Actual | Notes |
|----|----------|--------|-------------|-------------------|----------|--------|-------|
| TEN-001 | P2 | 🟢 Fixed | Wrong email shown in Profile section | 1. Login as tenant<br>2. Open Profile | Email matches the account used to sign in | A different or incorrect email is displayed | Was reading profile.email (stale) instead of user.email (auth) — now prefers user.email |
| TEN-002 | P2 | 🟢 Fixed | No date picker for Date of Birth in profile | 1. Login as tenant<br>2. Open Profile > Edit<br>3. Tap Date of Birth field | Calendar / date picker appears | Field is plain text input — no picker | Now uses @react-native-community/datetimepicker with native calendar |
| TEN-003 | P2 | 🔴 Open | Country code must be typed, not selected | 1. Login as tenant<br>2. Open Profile > Edit<br>3. Tap Country Code / Phone field | Dropdown or picker to select country code | Free text input — user must type e.g. +27 | Phone field placeholder shows +27 format; full picker deferred |
| TEN-004 | P1 | 🟢 Fixed | "Failed to update" when saving profile edits | 1. Login as tenant<br>2. Open Profile > Edit<br>3. Change any field<br>4. Tap Save | Profile saved, success toast shown | Error: "Failed to update profile" | Root cause: updateData included employment_start_date + utility_account_number which don't exist as columns in profiles — removed |
| TEN-005 | P1 | 🟢 Fixed | Cannot upload utility bill or bank statement in profile | 1. Login as tenant<br>2. Go to Profile / Verification<br>3. Tap upload for Utility Bill or Bank Statement | File / image picker opens, file uploads | Upload button was disabled={!editing} — user had to tap Edit first | Removed disabled gate — upload always available |
| TEN-006 | P0 | ⛔ Blocked | Cannot apply for a rental property | — | Tenant can browse and apply | Blocked because profile cannot be saved and verification incomplete | TEN-004 + TEN-005 now fixed — re-test |
| TEN-007 | P1 | 🟢 Fixed | Verification status still shows incomplete after completing all steps | 1. Login as tenant<br>2. Complete Identity Proof, Proof of Income, and Reference verification<br>3. Return to Home / Dashboard | Dashboard shows verification as complete | Dashboard still shows banners prompting user to complete verification | Was reading rental_applications (often null) — now reads profiles.id_number / monthly_income / proof_of_address_url |

---

## General / App-wide Bugs

| ID | Priority | Status | Description | Steps to Reproduce | Expected | Actual | Notes |
|----|----------|--------|-------------|-------------------|----------|--------|-------|
| GEN-001 | P0 | 🟢 Fixed | App forces sign-in on every reopen (session not persisted) | 1. Login to app<br>2. Close app fully (swipe away)<br>3. Reopen | User remains logged in, goes directly to dashboard | Sign-in screen shown — user must login again every time | supabase.ts had persistSession:true but no AsyncStorage adapter — added storage: AsyncStorage to createClient options |
| GEN-002 | P2 | 🔴 Open | Registration accepts invalid / non-real email addresses | 1. Go to Register<br>2. Enter a fake email like hello@hello.com<br>3. Complete registration | Only valid, deliverable emails accepted (or email verification required before access) | Account created with any string in email format | Requires enabling email verification in Supabase Auth settings (infrastructure change) |
| GEN-003 | P4 | 🟡 In Progress | Excessive emoji usage throughout the app | Across all screens | Icons used sparingly and purposefully; professional tone | Too many emojis used in labels, buttons, section headers — clutters the UI | Owner ProfileScreen emojis replaced with Ionicons. Full audit of all screens pending. |

---

## Re-Test Checklist (after fixes)

Use this section after fixes are applied to confirm resolution before marking Verified.

- [ ] **OWN-001** — Add a new property end-to-end as owner
- [ ] **OWN-002** — Owner profile name displays correctly
- [ ] **OWN-003** — Edit and save owner profile successfully
- [ ] **OWN-004** — Notifications screen loads without error
- [ ] **OWN-005** — After fixing OWN-001: test lease, maintenance, viewing flows
- [ ] **TEN-001** — Correct email shown in tenant profile
- [ ] **TEN-002** — Date of Birth field uses date picker
- [ ] **TEN-003** — Country code uses a picker / dropdown
- [ ] **TEN-004** — Tenant profile saves successfully
- [ ] **TEN-005** — Utility bill and bank statement upload works
- [ ] **TEN-006** — After fixing TEN-004 + TEN-005: tenant can apply for property
- [ ] **TEN-007** — Dashboard verification status updates correctly after completing all steps
- [ ] **GEN-001** — Reopening app after swipe-close keeps user logged in
- [ ] **GEN-002** — Fake emails rejected or require email verification before access
- [ ] **GEN-003** — Emoji usage reduced to professional level across all screens

---

## Summary

| Category | Total | P0 | P1 | P2 | P3 | P4 |
|----------|-------|----|----|----|----|-----|
| Owner | 5 | 2 | 1 | 1 | 0 | 0 |
| Tenant | 7 | 2 | 3 | 2 | 0 | 0 |
| General | 3 | 1 | 0 | 1 | 0 | 1 |
| **Total** | **15** | **5** | **4** | **4** | **0** | **1** |
