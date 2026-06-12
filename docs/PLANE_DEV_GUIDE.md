# Plane — Developer Integration Guide

Plane is the project management tool for all Lalarente tasks. This guide covers everything a developer needs to connect to Plane, read tasks, update status, create issues, and add comments — from any language or environment.

---

## 1. Connection Details

| Field | Value |
|-------|-------|
| **Base URL** | `http://100.79.34.78:8082` |
| **Workspace slug** | `appopoleis` |
| **Lalarente project ID** | `d4da1e50-3811-40f0-a9d7-7ec01c8f4164` |
| **Auth header** | `X-Api-Key: <your_token>` |

> **Getting your API token:** Log into Plane → Profile (top-right avatar) → **API Tokens** → Create token. The token looks like `plane_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.

The Plane instance runs on the internal network (`100.79.34.78`). You must be on the **same network or connected via Tailscale** to reach it. If you're working remotely, ask Arsalan for Tailscale access.

---

## 2. Key Reference IDs

### Issue States (Lalarente project)

| State name | ID | Group |
|------------|----|-------|
| Backlog | `31b53fd9-d1ed-4b32-8b63-9739c29046fb` | backlog |
| **Todo** | `22808aed-a3be-4896-ac9f-775508f78f09` | unstarted |
| **In Progress** | `e6ccac95-e685-4f0c-81a4-24741ca3d74a` | started |
| **Done** | `edaeca3f-419e-4be8-93f4-537eaecca382` | completed |
| Cancelled | `a226ab42-da95-44a8-a6ef-b170acdc8082` | cancelled |

### Team Members

| Name | Plane member ID | Role |
|------|----------------|------|
| Arsalan Shaikh | `b72a887a-5f58-4ada-91dc-2c889a4dd251` | Lead / PM |
| Aamir Behlim | `2fe84a38-fcd1-4b3b-9623-c630c70705a2` | Junior Dev |

### Priority Values
`urgent` · `high` · `medium` · `low` · `none`

---

## 3. API Patterns

All requests follow this structure:

```
BASE    = http://100.79.34.78:8082
PATH    = /api/v1/workspaces/{workspace_slug}/projects/{project_id}/{resource}/
HEADERS = { "X-Api-Key": "<your_token>", "Content-Type": "application/json" }
```

---

## 4. CRUD Examples — Python

Copy the snippet below into any Python script. Requires only `urllib` (stdlib — no installs).

```python
import urllib.request, json

BASE      = "http://100.79.34.78:8082"
TOKEN     = "plane_api_YOUR_TOKEN_HERE"          # replace with your token
WORKSPACE = "appopoleis"
PROJECT   = "d4da1e50-3811-40f0-a9d7-7ec01c8f4164"

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
new_issue = _req("issues/", method="POST", body={
    "name": "[FIX] My task title",
    "description_html": "<p>Clear description of what needs doing.</p>",
    "state": "22808aed-a3be-4896-ac9f-775508f78f09",   # Todo
    "priority": "high",
    "assignees": ["2fe84a38-fcd1-4b3b-9623-c630c70705a2"],  # Aamir
})
print(f"Created #{new_issue['sequence_id']} — id: {new_issue['id']}")
```

### Update an issue (move to In Progress)
```python
ISSUE_ID = "151531ba-cc72-42da-9643-05df883e2093"   # UUID from list call

_req(f"issues/{ISSUE_ID}/", method="PATCH", body={
    "state": "e6ccac95-e685-4f0c-81a4-24741ca3d74a",  # In Progress
})
```

### Mark an issue Done
```python
_req(f"issues/{ISSUE_ID}/", method="PATCH", body={
    "state": "edaeca3f-419e-4be8-93f4-537eaecca382",  # Done
})
```

### Reassign an issue
```python
_req(f"issues/{ISSUE_ID}/", method="PATCH", body={
    "assignees": ["b72a887a-5f58-4ada-91dc-2c889a4dd251"],  # Arsalan
})
```

### Add a comment
```python
ISSUE_ID = "151531ba-cc72-42da-9643-05df883e2093"

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
const BASE      = "http://100.79.34.78:8082";
const TOKEN     = "plane_api_YOUR_TOKEN_HERE";   // replace
const WORKSPACE = "appopoleis";
const PROJECT   = "d4da1e50-3811-40f0-a9d7-7ec01c8f4164";

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

// List issues
const { results } = await planeReq("issues/?per_page=50&order_by=-created_at");
results.forEach((i: any) => console.log(`#${i.sequence_id} ${i.name}`));

// Create issue
const issue = await planeReq("issues/", "POST", {
  name: "[FIX] My task",
  description_html: "<p>What needs doing and why.</p>",
  state: "22808aed-a3be-4896-ac9f-775508f78f09",  // Todo
  priority: "high",
  assignees: ["2fe84a38-fcd1-4b3b-9623-c630c70705a2"],
});
console.log(`Created #${issue.sequence_id}`);

// Update state → In Progress
await planeReq(`issues/${issue.id}/`, "PATCH", {
  state: "e6ccac95-e685-4f0c-81a4-24741ca3d74a",
});

// Add comment
await planeReq(`issues/${issue.id}/comments/`, "POST", {
  comment_html: "<p>PR raised: <a href='...'>link</a></p>",
});
```

---

## 6. curl — Quick One-Liners

```bash
export PLANE_TOKEN="plane_api_YOUR_TOKEN_HERE"
export BASE="http://100.79.34.78:8082/api/v1/workspaces/appopoleis/projects/d4da1e50-3811-40f0-a9d7-7ec01c8f4164"

# List issues
curl -s "$BASE/issues/?per_page=20" -H "X-Api-Key: $PLANE_TOKEN" | python3 -m json.tool

# Create issue
curl -s -X POST "$BASE/issues/" \
  -H "X-Api-Key: $PLANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"[FIX] My fix","state":"22808aed-a3be-4896-ac9f-775508f78f09","priority":"medium"}'

# Move issue to Done (replace ISSUE_UUID)
curl -s -X PATCH "$BASE/issues/ISSUE_UUID/" \
  -H "X-Api-Key: $PLANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state":"edaeca3f-419e-4be8-93f4-537eaecca382"}'

# Add comment
curl -s -X POST "$BASE/issues/ISSUE_UUID/comments/" \
  -H "X-Api-Key: $PLANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment_html":"<p>Done. PR: https://github.com/.../pull/XX</p>"}'
```

---

## 7. Developer Workflow Convention

When you pick up a task:

1. **Move it to In Progress** — PATCH the state to `e6ccac95...` as soon as you start
2. **Branch name** — match the issue type: `fix/`, `feat/`, `test/`, `docs/`, `chore/`
3. **When you raise a PR** — add a comment on the Plane issue with the PR link
4. **When the PR is merged** — move the issue to Done (`edaeca3f...`)

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
http://100.79.34.78:8082/appopoleis/projects/d4da1e50-3811-40f0-a9d7-7ec01c8f4164/issues/ISSUE_UUID/
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
