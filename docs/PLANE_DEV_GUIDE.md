# Plane — Developer Integration Guide

Plane is the project management tool for all Lalarente tasks. This guide covers everything a developer needs to connect to Plane, read tasks, update status, create issues, and add comments — from any language or environment.

---

## ⚠️ Where to Find Real Values

This guide uses **placeholders** (`{PLANE_BASE_URL}`, `{PROJECT_ID}`, etc.).  
**Never hardcode secrets or IDs into code or docs.** Get the real values from these sources:

| Placeholder | Where to find it |
|-------------|------------------|
| `{PLANE_BASE_URL}` | Supabase edge function secret `PLANE_URL` |
| `{WORKSPACE_SLUG}` | Supabase edge function secret `PLANE_WORKSPACE_SLUG` |
| `{PROJECT_ID}` | Supabase edge function secret `PLANE_PROJECT_ID` |
| `{API_KEY}` | Plane UI → Profile → API Tokens → Create token. Format: `plane_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| State UUIDs | `curl` the states API with your API key (see [Section 4](#4-crud-examples--python)) |
| Member UUIDs | `curl` the members API with your API key (see [Section 4](#4-crud-examples--python)) |
| Issue UUIDs | List all issues via the API, or extract from the Plane issue URL in the browser |

> **Supabase secrets reference:**
> ```bash
> npx supabase secrets list --project-ref vvepwaolnkzfzhzgxlwr
> ```
> Set via: `npx supabase secrets set PLANE_URL=<value> --project-ref vvepwaolnkzfzhzgxlwr`

---

## 1. Connection Details

| Field | Value |
|-------|-------|
| **Base URL** | `{PLANE_BASE_URL}` (set via `PLANE_URL` in Supabase secrets) |
| **Workspace slug** | `{WORKSPACE_SLUG}` (set via `PLANE_WORKSPACE_SLUG`) |
| **Lalarente project ID** | `{PROJECT_ID}` (set via `PLANE_PROJECT_ID`) |
| **Auth header** | `X-Api-Key: {API_KEY}` |

> **Getting your API token:** Log into Plane → Profile (top-right avatar) → **API Tokens** → Create token.

The Plane instance runs on the internal network. You must be on the **same network or connected via Tailscale** to reach it. If you're working remotely, ask Arsalan for Tailscale access and the base URL.

---

## 2. Key Reference IDs

> These UUIDs are project-specific constants. Fetch them dynamically via the API rather than hardcoding them.

### Issue States (Lalarente project)

| State name | Group |
|------------|-------|
| Backlog | `backlog` |
| Todo | `unstarted` |
| **In Progress** | `started` |
| **Done** | `completed` |
| Cancelled | `cancelled` |

> **To get the actual UUID for each state:** Use the states API endpoint (see [Section 9](#-workspace-level-api-all-projects)).

### Team Members

| Name | Role |
|------|------|
| Arsalan Shaikh | Lead / PM |
| Aamir Behlim | Junior Dev |

> **To get member UUIDs:** Use the members API endpoint (see [Section 9](#-workspace-level-api-all-projects)).

### Priority Values
`urgent` · `high` · `medium` · `low` · `none`

---

## 3. API Patterns

All requests follow this structure:

```
BASE    = {PLANE_BASE_URL}
PATH    = /api/v1/workspaces/{WORKSPACE_SLUG}/projects/{PROJECT_ID}/{resource}/
HEADERS = { "X-Api-Key": "{API_KEY}", "Content-Type": "application/json" }
```

---

## 4. CRUD Examples — Python

Copy the snippet below into any Python script. Requires only `urllib` (stdlib — no installs).

```python
import urllib.request, json

BASE      = "{PLANE_BASE_URL}"
TOKEN     = "{API_KEY}"                  # your Plane API token
WORKSPACE = "{WORKSPACE_SLUG}"
PROJECT   = "{PROJECT_ID}"

HEADERS = {"X-Api-Key": TOKEN, "Content-Type": "application/json"}

def _req(path, method="GET", body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        f"{BASE}/api/v1/workspaces/{WORKSPACE}/projects/{PROJECT}/{path}",
        data=data, headers=HEADERS, method=method
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())
```

### List all issues
```python
data = _req("issues/?per_page=50&order_by=-created_at")
for issue in data.get("results", []):
    print(f"#{issue['sequence_id']} [{issue.get('state_detail',{}).get('name','')}] {issue['name']}")
```

### Get a single issue by sequence ID
```python
# sequence_id is the #17, #18 etc you see in the UI
data = _req("issues/?per_page=100")
issue = next((i for i in data["results"] if i["sequence_id"] == 20), None)
print(issue["name"], issue["id"])
```

### Create an issue
```python
# Fetch state UUIDs and member UUIDs from the states/members API first
TODO_STATE_UUID = "..."   # look up via states endpoint
AAMIR_MEMBER_UUID = "..."  # look up via members endpoint

new_issue = _req("issues/", method="POST", body={
    "name": "[FIX] My task title",
    "description_html": "<p>Clear description of what needs doing.</p>",
    "state": TODO_STATE_UUID,   # Todo
    "priority": "high",
    "assignees": [AAMIR_MEMBER_UUID],  # Aamir
})
print(f"Created #{new_issue['sequence_id']} — id: {new_issue['id']}")
```

### Update an issue (move to In Progress)
```python
ISSUE_ID = "{ISSUE_UUID}"   # UUID from list call

# Fetch In Progress state UUID from states endpoint
IN_PROGRESS_STATE_UUID = "..."

_req(f"issues/{ISSUE_ID}/", method="PATCH", body={
    "state": IN_PROGRESS_STATE_UUID,  # In Progress
})
```

### Mark an issue Done
```python
# Fetch Done state UUID from states endpoint
DONE_STATE_UUID = "..."

_req(f"issues/{ISSUE_ID}/", method="PATCH", body={
    "state": DONE_STATE_UUID,  # Done
})
```

### Reassign an issue
```python
# Fetch member UUIDs from members endpoint
ARSALAN_MEMBER_UUID = "..."

_req(f"issues/{ISSUE_ID}/", method="PATCH", body={
    "assignees": [ARSALAN_MEMBER_UUID],  # Arsalan
})
```

### Add a comment
```python
_req(f"issues/{ISSUE_ID}/comments/", method="POST", body={
    "comment_html": "<p>Started on this. PR link: https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/XX</p>",
})
```

### Delete an issue
```python
_req(f"issues/{ISSUE_ID}/", method="DELETE")
```

---

## 5. CRUD Examples — TypeScript / JavaScript

Use this in any Node.js script or edge function.

```typescript
const BASE      = "{PLANE_BASE_URL}";
const TOKEN     = "{API_KEY}";            // replace
const WORKSPACE = "{WORKSPACE_SLUG}";
const PROJECT   = "{PROJECT_ID}";

async function planeReq(path: string, method = "GET", body?: object) {
  const res = await fetch(
    `${BASE}/api/v1/workspaces/${WORKSPACE}/projects/${PROJECT}/${path}`,
    {
      method,
      headers: { "X-Api-Key": TOKEN, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }
  );
  if (!res.ok) throw new Error(`Plane ${res.status}: ${await res.text()}`);
  return method === "DELETE" ? null : res.json();
}

// Fetch state UUIDs dynamically first
const statesRes = await planeReq("states/");
const todoUuid = statesRes.results.find((s: any) => s.name === "Todo")?.id;
const inProgressUuid = statesRes.results.find((s: any) => s.name === "In Progress")?.id;
const doneUuid = statesRes.results.find((s: any) => s.name === "Done")?.id;

// Fetch member UUIDs dynamically
const membersRes = await planeReq("members/");
const members = Array.isArray(membersRes) ? membersRes : (membersRes.results ?? []);
const aamirUuid = members.find((m: any) => m.display_name?.includes("Aamir"))?.id;
const arsalanUuid = members.find((m: any) => m.display_name?.includes("arsalan"))?.id;

// List issues
const { results } = await planeReq("issues/?per_page=50&order_by=-created_at");
results.forEach((i: any) => console.log(`#${i.sequence_id} ${i.name}`));

// Create issue
const issue = await planeReq("issues/", "POST", {
  name: "[FIX] My task",
  description_html: "<p>What needs doing and why.</p>",
  state: todoUuid,     // Todo
  priority: "high",
  assignees: [aamirUuid],
});
console.log(`Created #${issue.sequence_id}`);

// Update state → In Progress
await planeReq(`issues/${issue.id}/`, "PATCH", {
  state: inProgressUuid,
});

// Add comment
await planeReq(`issues/${issue.id}/comments/`, "POST", {
  comment_html: "<p>PR raised: <a href='...'>link</a></p>",
});
```

---

## 6. curl — Quick One-Liners

```bash
export PLANE_TOKEN="{API_KEY}"
export BASE="{PLANE_BASE_URL}/api/v1/workspaces/{WORKSPACE_SLUG}/projects/{PROJECT_ID}"

# List issues
curl -s "$BASE/issues/?per_page=20" -H "X-Api-Key: $PLANE_TOKEN" | python3 -m json.tool

# Create issue
curl -s -X POST "$BASE/issues/" \
  -H "X-Api-Key: $PLANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"[FIX] My fix","priority":"medium"}'

# First, get state UUIDs by listing states:
curl -s "$BASE/states/" -H "X-Api-Key: $PLANE_TOKEN" | python3 -c "import sys,json; [print(s['name'], s['id']) for s in json.load(sys.stdin).get('results',[])]"

# Move issue to Done (replace ISSUE_UUID with actual UUID + TODO_STATE_UUID)
curl -s -X PATCH "$BASE/issues/{ISSUE_UUID}/" \
  -H "X-Api-Key: $PLANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state":"DONE_STATE_UUID"}'

# Add comment
curl -s -X POST "$BASE/issues/{ISSUE_UUID}/comments/" \
  -H "X-Api-Key: $PLANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment_html":"<p>Done. PR: https://github.com/.../pull/XX</p>"}'
```

---

## 7. Developer Workflow Convention

When you pick up a task:

1. **Move it to In Progress** — PATCH the state to the In Progress UUID as soon as you start
2. **Branch name** — match the issue type: `fix/`, `feat/`, `test/`, `docs/`, `chore/`
3. **When you raise a PR** — add a comment on the Plane issue with the PR link
4. **⏰ 5 minutes after pushing: check PR for reviews** — the SA auditor (`khadeejahdreamcode`) typically auto-reviews within 1-5 minutes. Check for change requests and address them immediately.
5. **When the PR is merged** — move the issue to Done

Never close a Plane issue without a merged PR or a written reason in the comments.

---

## 8. Finding Issue UUIDs

The Plane UI shows sequence IDs (`#17`, `#20` etc.) but API calls that update/comment need the UUID. Two ways to get it:

**Option A — list all and grep:**
```python
data = _req("issues/?per_page=100")
for i in data["results"]:
    if i["sequence_id"] == 20:
        print(i["id"])   # the UUID
```

**Option B — from the issue URL in the browser:**
```
{PLANE_BASE_URL}/{WORKSPACE_SLUG}/projects/{PROJECT_ID}/issues/{ISSUE_UUID}/
```
The last segment before the trailing slash is the UUID.

---

## 9. Workspace-Level API (all projects)

To list all projects, members, or states without specifying a project:

```python
def _workspace_req(path, method="GET", body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        f"{BASE}/api/v1/workspaces/{WORKSPACE}/{path}",
        data=data, headers=HEADERS, method=method
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

# List all projects
projects = _workspace_req("projects/")
for p in projects.get("results", []):
    print(p["id"], p["name"])

# List all workspace members
members = _workspace_req("members/")
for m in (members if isinstance(members, list) else members.get("results", [])):
    member = m.get("member", m)
    print(member["id"], member.get("display_name") or member.get("email"))
```

---

## 10. Troubleshooting

| Problem | Fix |
|---------|-----|
| `Connection refused` | You're not on the internal network. Connect via Tailscale. |
| `403 Forbidden` | API token is wrong or expired. Regenerate in Plane Profile → API Tokens. |
| `404 Not Found` | Wrong project ID or issue UUID. Re-fetch the issue list to confirm IDs. |
| `400 Bad Request` | Usually a missing required field. `name` is required on issue create. |
| JSON decode error in curl | Pipe through `python3 -m json.tool` or `jq` to see the raw error. |
