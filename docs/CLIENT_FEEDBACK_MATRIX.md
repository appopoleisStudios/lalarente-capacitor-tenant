# Client feedback vs built state

Source: `navins_feedback/Feedback on Architecture (1).xlsx`  
Compared to: `main` codebase + DB audit 2026-06-04 (`vvepwaolnkzfzhzgxlwr`)

**Status legend:** OK · Built · Built (empty) · Built (hidden) · Partial · Missing · Validate

## Owner

| ID | Client summary | Status | Notes |
|----|----------------|--------|-------|
| O1 | Dynamic dashboard | Validate | `OwnerDashboardScreen` + `ownerDashboardApi` |
| O2 | Context-aware bell | Partial | Bell → notifications list with routed alerts |
| O3 | Inline alert cards | Built (empty) | No pending terminations/disputes in DB |
| O4 | Tiles navigate | OK | |
| O5 | Apps by property + Compare | Built (hidden) | Need 2+ applicants same property |
| O6 | Competition screen | Built (hidden) | `OwnerApplicationCompetitionScreen` |
| O7 | Request holding deposit | Built (empty) | 0 `holding_deposits` rows |
| O8 | Holding deposit screen | Built (empty) | Cross-property = all owner deposits on one screen |
| O9 | Dashboard holding count | Built (empty) | |
| O10 | Lease renewals CPA | Built | 0 `renewal_negotiations` |
| O11 | Execute renewal | Validate | Needs renewal-in-progress data |
| O12 | Rent roll + reminder | OK | |
| O13 | Payment disputes | Built (empty) | API + screen exist |
| O14 | Payment plan accept/reject | Built (empty) | |
| O15 | Early termination | Built (empty) | `/(owner)/early-termination` |
| O16 | Deposit management | Built | Interest accruals in DB |
| O17 | Deduction + finalise refund | Built (hidden) | Needs deposit workflow data |
| O18 | Send PO | Built (hidden) | `maintenance/send-po` |
| O19 | Maintenance chat + invoice | Built (hidden) | Needs MR with tenant |
| O20 | Inspections list | OK | |
| O21 | Inspection detail | Built | Blocked without lease-linked test |
| O22 | Inspection PDF template | Partial | `exportInspectionReportPdf` |
| O23 | Financial reports | OK | |
| O24 | Compliance / insurance / docs | OK | |
| O25 | Messaging | Built | 3 Navin/Nashin threads |
| O26 | Statements in tenant Documents | Validate | |

## Tenant

| ID | Client summary | Status | Notes |
|----|----------------|--------|-------|
| T1 | Dynamic dashboard | OK | |
| T2 | Activity routes | Validate | |
| T3 | Lease journey tracker | Missing | Only maintenance `TenantProgressTracker` |
| T4 | Application status + holding banner | Built | |
| T5 | Post-submit routing | Validate | |
| T6 | Self-registration | OK | |
| T7 | PDF income/reference | Partial | **P0:** PDF-only picker |
| T8 | Lease renewal | Built (hidden) | Nashin has active lease in DB |
| T9 | Arrears escalation UI | Built (empty) | |
| T10 | Payment disputes | Built (empty) | |
| T11 | Arrears on payments | Built (hidden) | Improve dashboard links **P0** |
| T12 | Holding deposit | Built (empty) | |
| T13 | Deposit status | Built (hidden) | |
| T14 | Maintenance | OK | |
| T15 | Work verification | Built (hidden) | `TenantReportsScreen` |
| T16 | Reports / inspections | Built (hidden) | **P0:** nav to Reports |
| T17 | Inspection history | Built (hidden) | |
| T18 | Documents | OK | |
| T19 | Messaging | Built (hidden) | Login as Nashin |
| T20 | Compose prefill | Built (hidden) | |
| T21 | Early termination | Built (hidden) | From lease screen |

## Infra / new

| ID | Summary | Status |
|----|---------|--------|
| I1 | Migrations | Built |
| I2 | Legal interest arrears | Built (empty) |
| I3 | CPA cure | Built (empty) |
| I4 | POPIA / DSAR | Partial — `/(tenant)/privacy` |
| I5 | Viewing expiry cron | Validate deploy |
| N1 | Lala AI chat | Missing on main — PR 1 |
| N2 | Messaging RLS | Risk — security PR |
