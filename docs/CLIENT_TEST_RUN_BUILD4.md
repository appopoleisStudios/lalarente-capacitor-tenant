# Client hands-on test run — build 4 (Sheet 2)

**Source:** `navins_feedback/Feedback on Architecture (1).xlsx` → tab **Feedback 2**  
**Tester:** Client QA personas — owner and tenant logins in team vault only (not in git)  
**Purpose:** Actionable bugs from real device testing — **not** the same as Sheet 1 architecture checklist.

Link from matrix: [CLIENT_FEEDBACK_MATRIX.md](./CLIENT_FEEDBACK_MATRIX.md) § Sheet 2.

## Severity legend

| Level | Meaning |
|-------|---------|
| P0 | Crash or core flow blocked |
| P1 | Major UX / functional defect |
| P2 | Enhancement / content / seed |

## Owner test script

| S2 | Step | Client result | Severity | Tracker / PR |
|----|------|---------------|----------|--------------|
| S2-01 | Dashboard stats (properties, leases, rent roll) | OK — counts seen | OK | — |
| S2-02 | Bell — 5 notifications | OK | OK | — |
| S2-03 | Viewings — pending 106 Cerise | Seen; could not accept/reject (expired date) | P2 | Viewing expiry / bell (S2-04) |
| S2-04 | Approve/decline viewing | Smart expiry on past date — OK behaviour | OK | — |
| S2-05 | Applications — Nashin app for 4A Dolphin | Only via **bell**, no Applications entry | P1 **Nav-gap** | New PR: owner Applications nav |
| S2-06 | Review application details | Architecture good; wants scoring explained | Validate | Docs |
| S2-07 | Accept/reject → lease | Worked; wants standard lease template | P2 content | Client to share template |
| S2-08 | Leases — 4B Dolphin active | OK | OK | — |
| S2-09 | Lease details deposit/payments | OK; wants walkthrough | Validate | — |
| S2-10 | Contact tenant → Messages | Works; **keyboard covers input** | P1 UX | Bugfix PR: messaging KAV |
| S2-11 | Rent roll April overdue | OK | OK | — |
| S2-12 | Payment reminder | OK | OK | — |
| S2-13 | Maintenance geyser — vendor routing | Works; dedicated vendors seed missing | P2 seed | Vendor seed PR (S2-13/14) |
| S2-14 | Assign vendor / open market | Same | P2 seed | — |
| S2-15 | Chat with tenant (maintenance) | Messaging works; **keyboard covers input** | P1 UX | Same as S2-10 |
| S2-16 | Inspections list 15 April | OK | OK | — |
| S2-17 | Open inspection — room checklist | **Cannot open room-by-room** | P0 | Bugfix PR: owner inspection rooms |
| S2-18 | Rate rooms / photos / notes | **Functionality not there** | P0 | Same PR as S2-17 |
| S2-19 | Messages thread geyser | OK | OK | — |
| S2-20 | Reply | OK | OK | — |
| S2-21 | Property photos — 4B Dolphin | **New photos don’t refresh** on view after edit | P1 | Bugfix PR: property photo refresh |
| S2-22 | Add property 12E Ocean | OK | OK | — |
| S2-23 | Edit property add photo | OK on edit screen | OK | — |

## Tenant test script (QA tenant login)

| S2 | Step | Client result | Severity | Tracker / PR |
|----|------|---------------|----------|--------------|
| S2-24 | Dashboard lease card | Lease seen; **downloadable lease PDF not visible** | P1 | Bugfix: tenant lease PDF link |
| S2-25 | Bell 4 notifications | OK | OK | — |
| S2-26 | Proof of address upload | **Photo only**, no files/PDF from phone | P1 | Bugfix: profile/doc picker (≠ T7 application) |
| S2-27 | Profile fields | OK | OK | — |
| S2-28 | Proof of address (profile) | Same as S2-26 | P1 | Same |
| S2-29 | Dashboard pending POA status | OK | OK | — |
| S2-30 | Lease screen | **Property name missing** on lease page | P1 data | Bugfix: `TenantLeaseScreen` |
| S2-31 | Contact owner → message | OK | OK | — |
| S2-32 | Payments history | OK | OK | — |
| S2-33 | Make payment mock | OK; payment gateway next | P2 | PayFast backlog |
| S2-34 | Arrears after payment | N/A (paid) | — | — |
| S2-35 | Reports maintenance history | OK | OK | — |
| S2-36 | New maintenance request | **Camera capture doesn’t upload** (gallery OK); wants **property description on tile** | P1 | Bugfix PR: maintenance camera + tile copy |
| S2-37 | Existing requests list | OK | OK | — |
| S2-38 | Messages thread | OK | OK | — |
| S2-39 | Messages from maintenance list | **Cannot open messages from maintenance** — must use Messages tab | P1 Nav | Bugfix PR: maintenance → thread |
| S2-40 | Send message | OK | OK | — |
| S2-41 | Dashboard upcoming inspection alert | **App crashes** | P0 | Bugfix PR: tenant inspection crash |
| S2-42 | Tap inspection alert | **App crashes** | P0 | Same as S2-41 |
| S2-43 | Viewing history 4A Dolphin | **Not seen** on tenant | P1 Nav-gap | Bugfix PR: tenant viewings entry |
| S2-44 | Application status 4A Dolphin | **Not seen** on tenant | P1 Nav-gap | Bugfix PR: tenant applications entry |

## Recommended PR stack (Sheet 2)

| Priority | PR theme | S2 rows |
|----------|----------|---------|
| 1 | Tenant inspection crash | S2-41, S2-42 |
| 2 | Owner inspection rooms / conduct | S2-17, S2-18 |
| 3 | Messaging keyboard | S2-10, S2-15 |
| 4 | Maintenance nav + camera + property tile | S2-36, S2-39 |
| 5 | Tenant lease PDF + property name | S2-24, S2-30 |
| 6 | Profile/docs PDF picker | S2-26, S2-28 |
| 7 | Property photo refresh | S2-21 |
| 8 | `fix/owner-applications-nav` — owner Applications entry + tenant viewings/apps | S2-05, S2-43, S2-44 (pair with [#8](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/8) for Compare **data**, not nav) |
| 9 | `feat/qa-vendor-seed` | S2-13, S2-14 |
