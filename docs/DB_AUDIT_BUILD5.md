# DB audit — build 5

**Project:** LaLarente  
**Supabase URL:** `https://vvepwaolnkzfzhzgxlwr.supabase.co`  
**project_ref:** `vvepwaolnkzfzhzgxlwr`  
**Audit date:** 2026-06-04  
**Method:** Supabase MCP (read-only)

## QA accounts

| Role | Name | Profile ID | Email |
|------|------|------------|-------|
| Owner | Navin Indraj | `e7f57cdd-78dd-41ab-9f4c-4333dd9776e6` | indraj.navin@gmail.com |
| Tenant | Nashin Indraj | `763dea05-493e-4f38-9d34-509da8e43bd8` | navin.indraj@yahoo.com |

## Active lease (Navin ↔ Nashin)

| Field | Value |
|-------|-------|
| Lease ID | `a1b2c3d4-0001-4000-a000-000000000001` |
| Status | `active` |
| Property | 4B Dolphin Crescent (`217247dd-832b-49da-843b-8002909f5553`) |

## Row counts (relevant)

| Table | Rows | Note |
|-------|------|------|
| profiles | 29 | |
| properties | 13 | Navin owns 13 |
| leases | 5 | 3 active, 2 early_terminated |
| rental_applications | 5 | |
| maintenance_requests | 11 | |
| message_threads | 4 | 3 involve Navin/Nashin |
| messages | 19 | |
| payment_disputes | **0** | UI empty for client |
| holding_deposits | **0** | |
| arrears_escalations | **0** | |
| payment_arrangements | **0** | |
| inspections | 4 | |
| notifications | 40 | |

## Seed recommendations

- **Do not** recreate Navin/Nashin or primary lease.
- **Optional** (demo only): 2nd application on same property (Compare UI), 1 payment_dispute, 1 holding_deposit, 1 maintenance_request on 4B Dolphin.
- Investigate app session: tenant flows hidden if login ≠ Nashin or `activeLease` query fails.

## Security advisory (MCP)

RLS disabled on: `message_threads`, `messages`, `message_attachments`, `documents`, `document_access_log`, `property_waitlist`, `standard_amenities`. Track in security PR **N2** — enable RLS with policies, do not enable without policies.

## Edge functions deployed

- `accrue-deposit-interest` (ACTIVE)
- `lala-ai-chat` — **not deployed** (pending PR 1)
