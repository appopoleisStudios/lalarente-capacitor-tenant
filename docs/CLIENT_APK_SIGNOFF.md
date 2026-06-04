# LaLarente — APK sign-off sheet (Build 5)

**Send this PDF or filled copy with every APK** so the client can confirm fixes and log new issues in one place.

---

## Release information

| Field | Value |
|-------|--------|
| **App name** | LaLarente Tenant |
| **Build label** | e.g. `1.0.0-build.5-rev.0` |
| **APK / build date** | |
| **Git commit / branch** | e.g. `main @ abc1234` |
| **Supabase project** | `vvepwaolnkzfzhzgxlwr` |
| **Tester (client)** | |
| **Device** | e.g. Samsung Galaxy / iPhone 14 |
| **OS version** | |

**Instructions:** Install the APK, sign in with **your own account**, and mark each row **Pass**, **Fail**, or **N/A**. Add notes for any Fail. List new bugs in Section 4.

---

## Section 1 — Shipped in this build (please verify)

These items were addressed in code merged for Build 5. Only you can confirm on your data and login.

### Tenant

| ID | What to test | Steps (summary) | Pass | Fail | N/A | Notes |
|----|--------------|-----------------|------|------|-----|-------|
| T7 | Application PDF upload | Search → property → Apply → upload **PDF** proof of income | ☐ | ☐ | ☐ | |
| T9–T12 | **Your tenancy** shortcuts | Dashboard → **Your tenancy** → Payments, Disputes, Holding deposits, Reports | ☐ | ☐ | ☐ | |
| T16–T17 | Inspection reports | **Reports & inspections** → open inspection (no crash) | ☐ | ☐ | ☐ | |
| T14 | Maintenance + camera | Report issue → **Camera** → attach photo | ☐ | ☐ | ☐ | |
| T19 | Message from maintenance | Maintenance → **Message landlord** → thread opens | ☐ | ☐ | ☐ | |
| — | Messaging keyboard | Messages → thread → type; input stays visible | ☐ | ☐ | ☐ | |
| — | Lease PDF | **View Lease Details** → **Download PDF** | ☐ | ☐ | ☐ | |
| — | **Viewing history** (nav) | Dashboard → **Viewings & applications** → Viewing history | ☐ | ☐ | ☐ | |
| — | **Application status** (nav) | Dashboard → **Viewings & applications** → Application status | ☐ | ☐ | ☐ | |
| — | Profile proof of address | **My Profile** → Proof of address → **Choose File (PDF or image)** | ☐ | ☐ | ☐ | S2-26 / S2-28 |
| N1 | Lala AI (tenant) | Dashboard or tab → **Lala AI** → send a message | ☐ | ☐ | ☐ | |

### Owner

| ID | What to test | Steps (summary) | Pass | Fail | N/A | Notes |
|----|--------------|-----------------|------|------|-----|-------|
| O5 | **Applications** entry | Dashboard → **My Documents** → **Applications** (not bell only) | ☐ | ☐ | ☐ | |
| O6 | Compare applicants | Applications → property with 2+ applicants → **Compare** | ☐ | ☐ | ☐ | Needs 2+ applicants on a property |
| O13 | Payment disputes empty copy | **Disputes** → empty state text clear | ☐ | ☐ | ☐ | |
| O21 | Inspection rooms | Inspections → in-progress → room checklist loads | ☐ | ☐ | ☐ | |
| O21 | Completed inspection read-only | Inspections → **Completed** → detail (not editable checklist) | ☐ | ☐ | ☐ | |
| O25 | Messaging keyboard | Messages → type in thread | ☐ | ☐ | ☐ | |
| — | Property photos after edit | Edit property photos → save → **property detail** shows new photos | ☐ | ☐ | ☐ | |
| O18 | **Send PO to vendor** | Maintenance request → **Purchase Order** → **Send PO to Vendor** | ☐ | ☐ | ☐ | Needs PO on a request |
| N1 | Lala AI (owner) | **Lala AI** tab → send a message | ☐ | ☐ | ☐ | |

---

## Section 2 — Known limitations (not in this build)

Do **not** fail the build for these unless behaviour regressed; they are planned or need separate work.

| Item | Sheet / ID | Status |
|------|------------|--------|
| Vendor demo seed | S2-13, S2-14 | Optional SQL seed |
| Lease PDF template wording | S2-07 | P2 content |
| Bell → direct deep link per notification | O2 | Partial |

---

## Section 3 — Regression smoke (quick)

| # | Check | Pass | Fail |
|---|--------|------|------|
| 1 | Login / logout (tenant + owner) | ☐ | ☐ |
| 2 | Dashboard loads without crash | ☐ | ☐ |
| 3 | Property list / search | ☐ | ☐ |
| 4 | Maintenance list + detail | ☐ | ☐ |
| 5 | Messages list + send | ☐ | ☐ |

---

## Section 4 — New bugs found on this APK

| # | Screen / step | Expected | Actual | Severity (P0–P2) |
|---|---------------|----------|--------|------------------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

---

## Section 5 — Sign-off

| | |
|--|--|
| **Overall result** | ☐ **Approved for next phase** &nbsp; ☐ **Approved with notes** &nbsp; ☐ **Not approved — fixes required** |
| **Client name** | |
| **Signature / date** | |
| **Dev team ack** | |

---

## Internal reference

- Full tracker: [CLIENT_FEEDBACK_MATRIX.md](./CLIENT_FEEDBACK_MATRIX.md)
- Sheet 2 detail: [CLIENT_TEST_RUN_BUILD4.md](./CLIENT_TEST_RUN_BUILD4.md)
- Automated UI tests (QA account only): [QA_E2E.md](./QA_E2E.md) — Maestro on staging credentials; **client account is manual sign-off only**.
