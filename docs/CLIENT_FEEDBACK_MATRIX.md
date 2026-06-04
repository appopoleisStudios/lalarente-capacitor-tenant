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
| O1 | Dynamic dashboard | Validate | — | |
| O2 | Context-aware bell | Partial | — | Not per-item direct routing |
| O3 | Inline alert cards | Built-empty | — | |
| O4 | Tiles navigate | OK | — | |
| O5 | Apps by property + Compare | Nav-gap | #8, `fix/owner-applications-nav` | S2-05: bell only — **seed #8 ≠ nav**; need Applications entry PR |
| O6 | Application competition | Built-hidden | #8, `fix/owner-applications-nav` | Needs 2+ applicants + nav to Applications |
| O7 | Request holding deposit | Built-empty | #8 | |
| O8 | Holding deposits screen | Built-empty | #8 | Cross-property = one list all properties |
| O9 | Dashboard holding count | Built-empty | #8 | |
| O10 | Lease renewals CPA | Built | — | |
| O11 | Execute renewal | Validate | — | |
| O12 | Rent roll + reminder | OK | — | S2-11, S2-12 OK |
| O13 | Payment disputes | Built-empty | #7 #8 | Client said “no architecture” = empty + copy (#7) |
| O14 | Payment plan accept/reject | Validate | #8 | Not only empty — verify UI with seeded arrangement |
| O15 | Early termination | Built-empty | — | |
| O16 | Deposit management | Built | — | |
| O17 | Deduction + finalise refund | Built-hidden | — | |
| O18 | Send PO | **Nav-gap** | — | S2: “where is this?” — route exists, no menu path |
| O19 | Maintenance chat + invoice | Built-hidden | — | Needs MR + tenant |
| O20 | Inspections list | OK | — | S2-16 OK |
| O21 | Inspection detail read-only | Partial | — | S2-17/18: rooms broken |
| O22 | Inspection PDF template | Partial | — | |
| O23a | Monthly statements PDF | OK | — | Split from old O23 |
| O23b | Tax report PDF | OK | — | |
| O23c | Invoices (rent + vendor) | OK | — | |
| O24a | Compliance / FICA | OK | — | Split from old O24 |
| O24b | Insurance claims | OK | — | |
| O24c | Notifications screen | OK | — | |
| O24d | Documents hub | OK | — | |
| O25 | Messaging | Built | — | S2-10/15 keyboard issue → Bug-S2 |
| O26 | Statements in tenant Documents | Validate | — | |

## Sheet 1 — Tenant

| ID | Client summary | Status | PR | Notes |
|----|----------------|--------|-----|-------|
| T1 | Dynamic dashboard | OK | — | |
| T2 | Activity routes | Validate | — | |
| T3 | Lease journey tracker | Missing | — | |
| T4 | Application status + holding banner | Built | `fix/tenant-viewings-applications-nav` | S2-43/44 nav-gap |
| T5 | Post-submit routing | Validate | — | |
| T6 | Self-registration | OK | — | |
| T7 | Application income/reference PDF | In-PR | #7 | |
| T8 | Lease renewal | Built-hidden | — | |
| T9 | Arrears escalation | **Nav-gap** | #7 | Client: visible on **owner**, not tenant — not “empty” |
| T10 | Payment disputes | **Nav-gap** | #7 #8 | Same |
| T11 | Arrears on payments screen | Nav-gap | #7 | Link exists when on Payments **with lease** |
| T12 | Holding deposit | **Nav-gap** | #7 #8 | Client: owner yes, tenant screen not found |
| T13 | Deposit status | Nav-gap | #7 | |
| T14 | Maintenance | OK | — | S2-36 camera bug |
| T15 | Work verification | Built-hidden | #7 | |
| T16 | Reports / inspections | Nav-gap | #7, `fix/inspection-crash-tenant` | #7 = nav; **crash** S2-41/42 = separate P0 PR |
| T17 | Inspection history | Nav-gap | #7, `fix/inspection-crash-tenant` | Same screen; crash blocks S2-42 |
| T18 | Documents | OK | — | |
| T19 | Messaging | Built | — | S2-39 maintenance nav |
| T20 | Compose prefill | Built-hidden | — | |
| T21 | Early termination | Nav-gap | — | Lease screen entry |

## Sheet 1 — Infrastructure

| ID | Summary | Status | PR | Notes |
|----|---------|--------|-----|-------|
| I1 | Migrations | Built | — | |
| I2 | Legal interest arrears | Built-empty | — | |
| I3 | CPA cure | Built-empty | — | |
| I4 | POPIA / DSAR | Partial | — | |
| I5 | Viewing expiry automation | Validate | — | |
| I6 | Deposit interest accrual Edge Function | OK | — | Client Sheet1: “seen and acceptable” — was missing from v1 matrix |
| N1 | Lala AI chat | In-PR | #6 | |
| N2 | Messaging RLS disabled | Risk | — | Security PR |

---

## Sheet 2 — Test run summary (44 steps)

Full table: [CLIENT_TEST_RUN_BUILD4.md](./CLIENT_TEST_RUN_BUILD4.md)

| Severity | Count | Examples |
|----------|-------|----------|
| P0 | 4 | S2-41/42 tenant inspection **crash**; S2-17/18 owner inspection **rooms** |
| P1 | 12+ | Keyboard S2-10/15; maintenance→messages S2-39; camera S2-36; lease PDF S2-24; property name S2-30; nav S2-05/43/44 |
| P2 | 4+ | Lease template S2-07; vendor seed S2-13/14; bell expired viewings S2-03/04 |

**Do not close Nav-gap rows (T9, T10, T12, O18, O5) with seed PR #8 alone** — #7 adds partial tenant nav; **O5** also needs `fix/owner-applications-nav` (S2-05), not seed alone.

---

## PR mapping (updated)

| PR | Scope | Closes |
|----|--------|--------|
| [#5](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/5) | This tracker + Sheet 2 doc + SDLC | Docs only |
| [#7](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/7) | Tenant **Your tenancy** nav, PDF application uploads, dispute copy | T7, part of T9–T13 nav — **not** S2-41/42 crash |
| [#8](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/8) | Demo **data** only | O6/O7/O13 data — **not** O5 nav |
| [#6](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/6) | Lala AI | N1 |
| **4** | `fix/inspection-crash-tenant` | S2-41, S2-42 (T16/T17 crash) |
| **5** | `fix/owner-inspection-rooms` | S2-17, S2-18 |
| **6** | `fix/messaging-keyboard` | S2-10, S2-15 |
| **7** | `fix/maintenance-messages-camera` | S2-36, S2-39 |
| **8** | `fix/tenant-lease-pdf` | S2-24, S2-30 |
| **9** | `fix/profile-docs-pdf-picker` | S2-26, S2-28 |
| **10** | `fix/property-photo-refresh` | S2-21 |
| **11** | `fix/owner-applications-nav` | S2-05, S2-43, S2-44 (O5 nav + tenant viewings/apps) |
| **12** | `feat/qa-vendor-seed` (or extend #8) | S2-13, S2-14 |
