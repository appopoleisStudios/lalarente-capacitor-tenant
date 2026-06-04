# DB audit — build 5

**Project:** LaLarente (Supabase project ref in team vault)  
**Audit date:** 2026-06-04  
**Auditor:** Engineering (manual review of query results against staging)

## Purpose

Confirm what QA data already exists before writing seed SQL or assuming “empty” screens are missing features.

## QA personas (credentials not in git)

| Role | Notes |
|------|--------|
| Owner QA account | Named client persona used for owner-side test script |
| Tenant QA account | Separate login used for tenant test script |

Login emails and profile UUIDs live in the **team password vault / Plane only** — never commit to the repository (POPIA).

## Lease and property state

- One **active lease** links the QA tenant to the QA owner on a Dolphin Crescent property.
- Owner QA account has multiple properties (mix of rented and available).
- Messaging threads exist between the two QA personas.

## Table row counts (snapshot)

| Area | Approx. rows | Implication for UI |
|------|--------------|-------------------|
| profiles | 29 | |
| properties | 13 | Owner QA has portfolio |
| leases | 5 | 3 active, 2 early-terminated |
| rental_applications | 5 | |
| maintenance_requests | 11 | |
| message_threads / messages | 4 / 19 | Messaging works with data |
| payment_disputes | 0 | Empty states, not missing screens |
| holding_deposits | 0 | |
| arrears_escalations | 0 | |
| payment_arrangements | 0 | |
| inspections | 4 | |
| notifications | 40 | |

## Seed recommendations

- Do **not** recreate QA users or the primary active lease.
- Optional demo rows only: second applicant on same property (Compare UI), one open dispute, one pending holding deposit.
- If tenant flows look “missing”, verify the tester used the **tenant** QA login and an session with `activeLease` loaded.

## Security follow-up

Open RLS hardening is tracked as matrix row **N2** in [CLIENT_FEEDBACK_MATRIX.md](./CLIENT_FEEDBACK_MATRIX.md). Table-level detail is kept in the **private** security backlog (GitHub/Plane), not in this file.

## Edge functions deployed

- `accrue-deposit-interest` — active
- `lala-ai-chat` — pending merge + deploy (build 5)
