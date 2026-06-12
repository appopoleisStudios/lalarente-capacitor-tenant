# Plane.so Access Guide (for Codebuff)

> **Purpose:** Memory doc so Codebuff doesn't forget how to access Plane.so.
> **Plane server:** Self-hosted at `http://100.79.34.78:8082`
> **Project:** Lalarente maintenance / dev tasks

---

## Quick Access

### Via Supabase admin-proxy (preferred)

Plane credentials are stored as Supabase edge function secrets:

| Secret | Description |
|---|---|
| `PLANE_API_KEY` | API key for Plane authentication |
| `PLANE_WORKSPACE_SLUG` | Workspace slug |
| `PLANE_PROJECT_ID` | Project UUID |
| `PLANE_URL` | Plane server URL |

**To fetch issues:**

```bash
curl -s -X POST "https://vvepwaolnkzfzhzgxlwr.supabase.co/functions/v1/admin-proxy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"target":"plane","method":"GET","resource":"issues"}'
```

**To fetch states:**

```bash
curl -s -X POST "https://vvepwaolnkzfzhzgxlwr.supabase.co/functions/v1/admin-proxy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"target":"plane","method":"GET","resource":"states"}'
```

### Via admin panel

Open the admin panel and navigate to `/dev/plane` to see issues in a table UI.

---

## Supabase Edge Function Details

The proxy runs in `supabase/functions/admin-proxy/index.ts` and:
- Reads `PLANE_API_KEY`, `PLANE_WORKSPACE_SLUG`, `PLANE_PROJECT_ID`, `PLANE_URL` from env
- Forwards requests to `{PLANE_URL}/api/v1/workspaces/{workspace}/projects/{project}/{resource}/`
- Uses `X-Api-Key` header for auth

**Secrets management:**

```bash
npx supabase secrets set PLANE_API_KEY=<key> --project-ref vvepwaolnkzfzhzgxlwr
npx supabase secrets set PLANE_URL=<url> --project-ref vvepwaolnkzfzhzgxlwr
npx supabase secrets set PLANE_WORKSPACE_SLUG=<slug> --project-ref vvepwaolnkzfzhzgxlwr
npx supabase secrets set PLANE_PROJECT_ID=<id> --project-ref vvepwaolnkzfzhzgxlwr
```

To list all secrets:

```bash
npx supabase secrets list --project-ref vvepwaolnkzfzhzgxlwr
```

---

## State Mapping

Plane states have `id`, `name`, and `group` fields. The groups are:

| Group | Meaning |
|---|---|
| `backlog` | Backlog |
| `unstarted` | Todo |
| `started` | In Progress |
| `completed` | Done |
| `cancelled` | Cancelled |

---

## PR ↔ Plane Task Mapping (as of 2026-06-12)

| Plane Task | Priority | State | GitHub PR |
|---|---|---|---|
| [SEC] Fix messaging RLS — restrict thread read access (N2) | URGENT | In Progress | #49 |
| [FEAT] Inspection PDF export (O22) | Medium | Todo | — |
| [FEAT] Lease PDF template auto-population (S2-07/08) | High | Todo | — |
| [FEAT] Lease journey tracker (T3) | High | Todo | — |
| [SEED] Load dedicated vendor records | High | Todo | — |
| [FIX] Early Termination entry on Payments | Medium | Todo | — |
| [FIX] Chat with Owner on maintenance detail | Medium | Todo | — |
| [TEST] Notification templates (email + SMS) | Low | In Progress | #46 |
| [TEST] SA Business Day Calculator | Medium | In Progress | #44 |
| [GH 20+21] ErrorBoundary + Release Tagging | Medium | In Progress | #42 |
| [GH #28] Epic 6: Legal-Math Unit Tests | High | In Progress | #45 |
| [GH 27] Jest + ts-jest Harness | Medium | Done | #43 |
| [GH #18] Epic 1: Crash Reporting (Sentry) | High | Done | #42 |
| feat(ai-chat): Lala AI assistant | Medium | Done | — |
| [GH #32] Epic 5: Shared Component Library & Dedupe | High | Backlog | — |
| [GH #29] Epic 4: TanStack Query Migration | High | Backlog | — |
| [GH #26] Epic 3: API-layer Unit Tests | High | Backlog | — |
| [GH #22] Epic 2: CI/CD Pipeline | High | Backlog | — |
| [GH 23+24+25] CI/CD Pipeline | Medium | Backlog | — |
| [GH 2+3] AI Chat Features | Medium | Backlog | — |

---

## Fetching full issue details (with states)

To see which state each issue is in, you need to join issues with states:

```python
import sys, json
data = json.load(sys.stdin)
results = data.get('results', []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
for r in results:
    print(f"  [{r.get('priority','?'):4s}] {r.get('name','?')[:80]}")
    print(f"      state_id: {r.get('state','?')}")
    print(f"      completed_at: {r.get('completed_at','?')}")
```

Then map `state` UUID to state name via the states endpoint.

---

## SA (Security Audit) Reviews

- SA reviewer on GitHub: `khadeejahdreamcode`
- All open PRs must pass SA review before merge
- PR security checklist template: `docs/PR_SECURITY_CHECKLIST.md`
