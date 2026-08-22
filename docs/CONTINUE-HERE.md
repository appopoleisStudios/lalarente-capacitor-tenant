# LalaRente — CONTINUE HERE (cross-account handoff)

**Purpose:** Full working context so any Cursor account / agent can resume without the prior chat.  
**Updated:** 2026-08-22  
**Repo:** `appopoleisStudios/lalarente-capacitor-tenant` (local often `lalarente-app`)  
**Default branch:** `main` @ `ca11412`+ (confirm with `git log -1`)

---

## 1. Who you are in this project

- **Arsalan** = product owner / lead.
- **You (this agent)** = **SA** (Solution Architect): review Freebuff PRs, APPROVE / REQUEST CHANGES via `gh`, merge when ship-ready, keep Plane truthful, do not write feature code unless asked.
- **Freebuff / Nuaman14** = implementer.
- Ignore Aamir’s PRs unless told.

Hard product rule (regressed 4× — never again):

> Tenant bottom navbar = exactly **Home, Search, Payments, Profile, Lala AI**.  
> **No “Vendor Payments” tab.** Routes stay under `vendor-payments/*` with `href: null` on **leaf** routes (`vendor-payments/index`, not bare `vendor-payments`).  
> Guard: `.maestro/flows/tenant-tabbar-guard.yaml`.

---

## 2. What the app is

Expo / React Native (Capacitor) rental platform for **South Africa** (CPA, RHA, FICA, deposits).  
Roles: **tenant / owner / vendor** (+ admin web).

Plain-English map: [`docs/inventory/START-HERE.md`](docs/inventory/START-HERE.md)  
Method / generators: [`docs/inventory/`](docs/inventory/)

Build (do not change without asking):

- EAS profile **`preview`** for APK
- Env via `Constants.expoConfig.extra` / `src/config/env.ts` — not scattered `process.env`
- Supabase project: **`vvepwaolnkzfzhzgxlwr`** (`https://vvepwaolnkzfzhzgxlwr.supabase.co`)

---

## 3. Just shipped (this thread)

| PR       | What                                                                                      | Merge            |
| -------- | ----------------------------------------------------------------------------------------- | ---------------- |
| **#154** | Invoice life-cycle: tenant approve/reject, vendor resubmit, entry points (#105/#108/#109) | Merged           |
| **#155** | SA blocker: tenant approve/reject notifies **vendor** too                                 | Merged `c69761e` |
| **#156** | Owner manual FICA (#98/#101), deposit comparison (#100), lease automation cron (#102)     | Merged `52831d5` |

SA bar for money/legal Edge functions: **`verifyServiceRole`** (same as `process-vendor-payouts`). Fail-open Bearer = REQUEST CHANGES.

Lease expiry notices: **once per lease** via `notifications.data.lease_id` (not daily/weekly). Optional later: CPA 80/60/40 **business-day** milestones (see SA rental skill).

---

## 4. Live DB migration status (checked 2026-08-22)

`supabase_migrations.schema_migrations` only tracks **3** CLI files (`supabase/migrations/202607*`).  
Most of `database/migrations/001–066` were applied ad hoc or never tracked.

**Applied / fixed live this session:**

| Item                                                       | Status                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **045** `maintenance_invoice_audit_logs`                   | ✅ created + RLS                                                                                   |
| **045b** authenticated insert `actor_id = auth.uid()`      | ✅ (needed for app `logAuditEvent`)                                                                |
| **065** `tenant_invoice_update`                            | ✅                                                                                                 |
| **066** cron `process-lease-automation`                    | ✅ active `0 6 * * *`, **vault-backed** (`vault.decrypted_secrets`) — no JWT in `cron.job.command` |
| Edge `process-lease-automation`                            | ✅ deployed                                                                                        |
| Vault secrets `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | ✅ present                                                                                         |

**Still true / follow-ups:**

- Other crons (e.g. `process-vendor-payouts-daily`) may still bake service-role JWT in plaintext — same vault treatment recommended.
- Repo file `database/migrations/066_schedule_lease_automation_cron.sql` corrected to use `vault.decrypted_secrets` (not non-existent `vault.decrypt_secret`). Commit if still dirty.
- Rotating the service-role key is still wise after it lived in cron history — update vault + all jobs together.

---

## 5. Plane board (LAL project)

- **URL:** https://plane.appopoleis.com
- **Workspace:** `appopoleis`
- **Project LAL:** `d4da1e50-3811-40f0-a9d7-7ec01c8f4164`
- **Token:** from memory `reference_plane.md` or `/Volumes/ExternalSD/Development/research-agent/.env` → `PLANE_API_TOKEN` (never commit tokens).
- Auth header: `X-Api-Key`. Prefer browser UA; some clients get filtered.

**Decision from chat:** _nothing gets deleted_ — park/backlog, don’t Cancel. Board was restored after a mass Cancel wipe.

**Done this week (among others):** #98, #100, #101, #102, #105, #108, #109, #111 (and older epics).

**Open / next (as of handoff):**

| #         | State       | Priority | Title                                       |
| --------- | ----------- | -------- | ------------------------------------------- |
| **107**   | In Progress | urgent   | Invoice epic (children remain)              |
| **110**   | Todo        | high     | Chat/call on invoice; escalate to LalaRente |
| **106**   | Todo        | high     | Owner vendor directory (Uber/UrbanClap)     |
| **99**    | Todo        | urgent   | Unfinished-product parent epic              |
| **94–97** | Backlog     | —        | Lala tool-calling agent (“backlog for now”) |
| **103**   | Backlog     | low      | Mediation unused                            |
| **104**   | Backlog     | low      | Product map / Maestro walk — do later       |

Vendor directory issue: [#106](https://plane.appopoleis.com/appopoleis/projects/d4da1e50-3811-40f0-a9d7-7ec01c8f4164/issues/39c61391-2100-4abe-9c5a-91796dfb6a9d/) (owner-focused as filed; tenants not in scope yet).

---

## 6. Access cheatsheet (no secrets in this file)

| System                  | How                                                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub**              | `gh` + credential helper; PRs on `lalarente-capacitor-tenant`                                                                                                                                        |
| **Plane**               | `https://plane.appopoleis.com` + `X-Api-Key` (see memory / research-agent `.env`)                                                                                                                    |
| **LalaRente Supabase**  | Project `vvepwaolnkzfzhzgxlwr`; Management API with `SUPABASE_ACCESS_TOKEN` from local `.env`                                                                                                        |
| **Intel / books KB**    | Schema `intel.agent_intel` on **ai-router** project `zgtrjnmmylwsukdeokzk`; service key in `/Volumes/ExternalSD/Development/ai-router/.env` (`SUPABASE_SERVICE_KEY`); header `Accept-Profile: intel` |
| **SA rental law skill** | `/Users/appopoleis/Developer/ai-router/lalarente/sa-rental-property-mgmt/` (or ExternalSD twin)                                                                                                      |
| **Plane memory**        | `~/.claude/projects/-Volumes-ExternalSD-Development/memory/reference_plane.md`                                                                                                                       |
| **DB schema memory**    | same folder `db-schema.md`                                                                                                                                                                           |
| **Cursor rule**         | `.cursor/rules/sa-intel-kb.mdc` — SA reviews must query Intel KB + SA skill                                                                                                                          |

Do **not** confuse MCP default Supabase (often ai-router/intel) with LalaRente `vvepwaolnkzfzhzgxlwr`.

---

## 7. How SA reviews work

1. `gh pr view` + diff + CI.
2. For money/legal/cron/auth: check Edge auth, RLS, idempotency; ground in **Intel books KB** + **SA rental skill**.
3. Comment APPROVE or REQUEST CHANGES on the PR.
4. Merge with `gh pr merge --squash` when asked / ship-ready.
5. Update Plane issues (comment + state).
6. Maestro when UI path exists and a device is available.

---

## 8. Suggested next moves

1. Commit + push any dirty handoff / `066` file / `.cursor/rules` if not already on `main`.
2. Product: **#106** vendor directory **or** finish invoice epic **#110**.
3. Ops: vault-migrate remaining crons; consider service-role rotation.
4. Unfinished product epic **#99** still open (screening is manual-complete interim, not a bureau).

---

## 9. Prior chat (this machine)

Cursor agent transcript (same Mac):  
`~/.cursor/projects/Users-appopoleis-Developer-lalarente-lalarente-app/agent-transcripts/b69c878e-9029-438e-893e-87b303423b4b/`

Cite as: [Invoice + Plane SA thread](b69c878e-9029-438e-893e-87b303423b4b)

---

## 10. Resume prompt (paste into new Cursor account)

```
You are SA for LalaRente (appopoleisStudios/lalarente-capacitor-tenant).
Read docs/CONTINUE-HERE.md and docs/inventory/START-HERE.md first.
Follow .cursor/rules/sa-intel-kb.mdc (Plane + Intel KB + SA rental skill).
Current open Plane work: #107/#110 invoice escalate, #106 vendor directory, #99 unfinished product.
Do not add a Vendor Payments tab. Ask before changing EAS build profiles.
```
