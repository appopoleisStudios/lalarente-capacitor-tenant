# Client feedback vs built state — live tracker

**Sources:**

- **Sheet 1** — `navins_feedback/Feedback on Architecture (1).xlsx` → tab **Feedback 1** (architecture / validation)
- **Sheet 2** — same file → tab **Feedback 2** (44-step hands-on test) → detail in [CLIENT_TEST_RUN_BUILD4.md](./CLIENT_TEST_RUN_BUILD4.md)

**DB / project:** `vvepwaolnkzfzhzgxlwr` · audit [DB_AUDIT_BUILD5.md](./DB_AUDIT_BUILD5.md)

**Canonical copy:** also in Cursor plan doc § Live tracker (keep in sync after merges).

## Status legend

| Status | Meaning |
|--------|---------|
| OK | Client signed off |
| Fixed | Bug/gap resolved by a merged PR |
| Built | Screen + API exist; works with data |
| Built-empty | Screen exists; **no rows in DB** (seed may help) |
| Nav-gap | Screen exists; **no entry point** on that role’s nav (seed will not fix) |
| Built-hidden | Exists but client couldn’t find (login, lease session, or obscure route) |
| Partial | Incomplete vs spec |
| Missing | Not implemented |
| Validate | Needs QA / explanation |
| In-PR | Fix open in a PR |
| Bug-S2 | Sheet 2 test bug — see S2-## |

---

## Sheet 1 — Owner

| ID | Client summary | Status | PR | Notes |
|----|----------------|--------|-----|-------|
| O1 | Dynamic dashboard | OK | — | All dashboard features working, counts accurate |
| O2 | Context-aware bell | OK | — | Notifications routed to relevant screens |
| O3 | Inline alert cards | OK | — | Inline alerts displayed with seeded data |
| O4 | Tiles navigate | OK | — | |
| O5 | Apps by property + Compare | ✅ **Fixed** | #14 (`fix/owner-applications-nav`) | Applications nav entry added to owner menu |
| O6 | Application competition | ✅ **Fixed** | #8, #14 | Competition screen + nav both working |
| O7 | Request holding deposit | ✅ **Fixed** | #8 | Seeded data populates the flow |
| O8 | Holding deposits screen | ✅ **Fixed** | #8 | Cross-property list populated with seed data |
| O9 | Dashboard holding count | ✅ **Fixed** | #8 | Count visible with seeded data |
| O10 | Lease renewals CPA | Built | — | |
| O11 | Execute renewal | OK | — | Verified working |
| O12 | Rent roll + reminder | OK | — | S2-11, S2-12 OK |
| O13 | Payment disputes | ✅ **Fixed** | #7 #8 | Empty state + copy added, data seeded |
| O14 | Payment plan accept/reject | ✅ **Fixed** | #8 | UI verified with seeded arrangements |
| O15 | Early termination | OK | — | |
| O16 | Deposit management | Built | — | |
| O17 | Deduction + finalise refund | OK | — | |
| O18 | Send PO | ✅ **Fixed** | #15 (`fix/owner-send-po-nav`) | Send PO screen built + nav entry added |
| O19 | Maintenance chat + invoice | OK | — | |
| O20 | Inspections list | OK | — | S2-16 OK |
| O21 | Inspection detail read-only | ✅ **Fixed** | #9 (`fix/p0-inspections`) | Room-by-room checklist working with photos/ratings |
| O22 | Inspection PDF export | ✅ **Fixed** | #55 (`feat/inspection-pdf-export-header`) | PDF export button added to inspection header |
| O23a | Monthly statements PDF | OK | — | Split from old O23 |
| O23b | Tax report PDF | OK | — | |
| O23c | Invoices (rent + vendor) | OK | — | |
| O24a | Compliance / FICA | OK | — | Split from old O24 |
| O24b | Insurance claims | OK | — | |
| O24c | Notifications screen | OK | — | |
| O24d | Documents hub | OK | — | |
| O25 | Messaging | ✅ **Fixed** | #16, #49 | Keyboard fix applied; RLS secured |
| O26 | Statements in tenant Documents | OK | — | Tenant can view statements via Documents |

## Sheet 1 — Tenant

| ID | Client summary | Status | PR | Notes |
|----|----------------|--------|-----|-------|
| T1 | Dynamic dashboard | OK | — | |
| T2 | Activity routes | OK | — | All routes functional |
| T3 | Lease journey tracker | ✅ **Built** | #50 (`feat/lease-journey-tracker-t3`) | Timeline tracker screen implemented |
| T4 | Application status + holding banner | Built | `fix/tenant-viewings-applications-nav` | S2-43/44 nav fixed via #14 |
| T5 | Post-submit routing | OK | — | Verified working |
| T6 | Self-registration | OK | — | |
| T7 | Application income/reference PDF | ✅ **Fixed** | #7, #17 | `pickPdfOnly()` enforces PDF upload for income + references |
| T8 | Lease renewal | OK | — | |
| T9 | Arrears escalation | ✅ **Fixed** | #7, #16 | `/(tenant)/arrears` in dashboard TENANCY_SHORTCUTS |
| T10 | Payment disputes | ✅ **Fixed** | #7 #8, #16 | Tenant payment disputes screen with empty state |
| T11 | Arrears on payments screen | ✅ **Fixed** | #7, #16 | Link visible on Payments screen with active lease |
| T12 | Holding deposit | ✅ **Fixed** | #7 #8, #16 | `/(tenant)/holding-deposit` in dashboard shortcuts |
| T13 | Deposit status | ✅ **Fixed** | #7, #16 | Deposit card shown unconditionally when active lease exists |
| T14 | Maintenance | OK | — | S2-36 camera fixed via #10 |
| T15 | Work verification | OK | — | |
| T16 | Reports / inspections | ✅ **Fixed** | #7, #57/#58 | Crash fixed + nav entry present |
| T17 | Inspection history | ✅ **Fixed** | #7, #57/#58 | Crash fixed + screen accessible |
| T18 | Documents | OK | — | |
| T19 | Messaging | Built | — | S2-39 maintenance nav fixed via #10 |
| T20 | Compose prefill | OK | — | |
| T21 | Early termination | ✅ **Fixed** | #16 | `/(tenant)/early-termination` in dashboard TENANCY_SHORTCUTS |

## Sheet 1 — Infrastructure

| ID | Summary | Status | PR | Notes |
|----|---------|--------|-----|-------|
| I1 | Migrations | Built | — | |
| I2 | Legal interest arrears | Built | — | |
| I3 | CPA cure | Built | — | |
| I4 | POPIA / DSAR | Built | — | |
| I5 | Viewing expiry automation | OK | — | Auto-expiry working |
| I6 | Deposit interest accrual Edge Function | OK | — | Client Sheet1: “seen and acceptable” — was missing from v1 matrix |
| N1 | Lala AI chat | ✅ **Built** | #6 | LalaChatScreen.tsx deployed via Edge Function |
| N2 | Messaging RLS disabled | ✅ **Fixed** | #49 | Migration 043 restricts thread read access to participants only |

---

## Sheet 2 — Test run summary (44 steps)

Full table: [CLIENT_TEST_RUN_BUILD4.md](./CLIENT_TEST_RUN_BUILD4.md)

### ✅ All 44 steps resolved

| Severity | Count | Status |
|----------|-------|--------|
| P0 | 4 → **0** | ✅ All fixed (S2-41/42 crash, S2-17/18 rooms) |
| P1 | 12+ → **0** | ✅ All fixed (keyboard, nav, camera, PDF, photo refresh) |
| P2 | 4+ → **0** | ✅ All fixed (lease template, vendor seed, bell viewings) |

**All previously open rows (T9, T10, T12, O18, O5, T16, T17, T21) have been resolved by merged PRs.**

---

## PR mapping — Complete (all gaps resolved)

| PR | Scope | Closes |
|----|--------|--------|
| [#5](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/5) | This tracker + Sheet 2 doc + SDLC | Docs only |
| [#6](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/6) | Lala AI + Supabase Edge Function | N1 |
| [#7](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/7) | Tenant nav, PDF uploads, disputes UX | T7, T9–T13 partial nav |
| [#8](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/8) | Demo seed data | O6, O7, O8, O9, O13, O14 data |
| [#9](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/9) | P0 inspections — crash + room checklist | S2-17, S2-18, S2-41, S2-42 (O21, T16, T17) |
| [#10](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/10) | P1 messaging keyboard, camera, lease nav | S2-10, S2-15, S2-36, S2-39 |
| [#12](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/12) | Profile proof of address PDF picker | S2-26, S2-28 |
| [#13](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/13) | Property photo refresh | S2-21 |
| [#14](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/14) | Owner Applications nav + tenant viewings/apps nav | O5, S2-05, S2-43, S2-44 |
| [#15](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/15) | Send PO nav on maintenance detail | O18 |
| [#16](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/16) | REV2 — keyboard overlap, lease PDF gen, tenant nav shortcuts, empty states | S2-10, S2-15, S2-24, S2-30, T9–T13, T21 |
| [#17](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/17) | PDF file picker for tenant verification docs (Tier 3) | T7 |
| [#49](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/49) | Messaging RLS — restrict thread read access | N2 |
| [#50](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/50) | Tenant lease journey timeline tracker | T3 |
| [#51](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/51) | Chat with Owner button + seed vendor SQL | S2-13, S2-14 |
| [#52](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/52) | Lease PDF template — client Unicity format | S2-07 |
| [#55](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/55) | Inspection PDF export button | O22 |
| [#57/#58](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/58) | Tenant inspection cards tappable — crash fix | S2-41, S2-42 |
