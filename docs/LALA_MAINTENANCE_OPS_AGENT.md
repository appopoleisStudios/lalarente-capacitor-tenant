# Lala Maintenance Ops Agent — Plan

> **Status:** Plan — ready for review before implementation  
> **Date:** July 16, 2026  
> **Goal:** Extend Lala from read-only Q&A into a **tool-calling maintenance ops agent** that runs the existing MMS workflow, with **owner confirmation at money steps**.

---

## 1. Problem statement

Every maintenance job on LaLarente forces the owner through the same multi-party loop:

```
Tenant report → Acknowledge → Route vendors → Compare quotes
  → Accept quote / PO → Chase progress + photos → Closure → Invoice
```

The APIs and screens for that loop already exist. Lala AI (`lala-ai-chat`) today only loads context and replies in text — it **cannot mutate** anything. Owners still do ~8–12 repetitive taps per job.

**This plan turns Lala into an ops agent that proposes and executes MMS actions, while humans keep final say on money.**

---

## 2. Current state (what we have)

| Layer | Today | Gap |
|-------|-------|-----|
| Edge chat | `supabase/functions/lala-ai-chat/index.ts` | Groq chat only; no tools; max 4 sentences; owner/tenant only |
| Context | Owner: properties + last 8 MRs + leases. Tenant: leases | No quotes, POs, closure, invoices in context |
| Client UI | `LalaChatScreen` | Text in / text out; no confirmation cards |
| MMS APIs | Rich modular APIs under `src/features/maintenance/api/` | Client-only; not wrapped for Edge tool calls |
| Notifications | `notificationsApi` | Agent should reuse, not invent a channel |

### Existing APIs the agent will wrap

| Capability | Module |
|------------|--------|
| Request status / acknowledge | `requests/maintenanceWorkflow.api.ts` |
| Route vendors | `vendors/vendorRouting.api.ts` (`pushToOpenMarket`, `pushToDedicatedVendors`, `pushToSelectedVendors`) |
| Discover vendors | `vendors/vendorDiscovery.api.ts` (`getVendorsByCategory`) |
| Quotes list / accept / reject / revision | `quotes/quotes.api.ts`, `quotes/quoteActions.api.ts` |
| PO send | `purchase-orders/poActions.api.ts` (`sendPOToVendor`) |
| Progress | `work/workExecution.api.ts`, `work/workProgress.api.ts` |
| Closure | `work/workClosure.api.ts` (`approveClosureReport`, `rejectClosureReport`) |
| Tenant verification | `work/tenantVerification.api.ts` |
| Invoices | `invoices/invoices.api.ts` |

Reference: `src/features/maintenance/api/QUICK_REFERENCE.md`, `API_CONTRACT.md`.

---

## 3. Goals and non-goals

### Goals (v1)

1. Owner can ask Lala to **drive a maintenance request** from report → routed → quoted → PO → closure recommend.
2. Agent uses **real tools** (Edge → service-role wrappers of existing MMS logic), not invented state.
3. **Money steps always require explicit owner confirmation** in the app UI before the tool runs.
4. Agent can **summarize quotes**, flag outliers, and recommend accept/reject with reasons.
5. Agent can **nudge** (notifications) when quotes/progress/closure are stalled.
6. Full audit trail of tool calls (who, what, when, args, result).

### Non-goals (v1)

- Vendor-facing Lala agent (vendors stay on their own screens).
- Auto-paying vendors / PayFast / `vendor_payments` (separate architecture; agent may *remind* owner/tenant to pay later).
- Auto-accept quotes without owner confirm.
- Legal advice, CPA formal notices drafting as authoritative counsel.
- Replacing owner screens — agent is a co-pilot, not the only path.

---

## 4. Product principle: confirmation tiers

Every tool is classified:

| Tier | Meaning | UX | Examples |
|------|---------|----|----------|
| **A — Read** | Safe; auto-run | Silent or inline summary | `get_request`, `list_quotes`, `compare_quotes` |
| **B — Ops** | Mutates workflow; low money risk | One-tap confirm (“Do it”) | `acknowledge_request`, `push_open_market`, `request_quote_revision`, `notify_vendor_progress` |
| **C — Money** | Creates financial commitment | Explicit confirm card: amount, vendor, quote ID, “I approve” | `accept_quote`, `send_po`, `approve_invoice` |
| **D — Forbidden** | Never exposed to model | — | Direct bank payout, change fees, impersonate tenant pay |

**Rule:** Model may *propose* Tier C; Edge executes Tier C only after a signed confirmation token from the client (see §7).

---

## 5. Target architecture

```
┌─────────────────────┐
│  LalaChatScreen     │  chat + ConfirmationCard (Tier B/C)
│  (owner / tenant)   │
└──────────┬──────────┘
           │ JWT + message (+ optional confirm_token)
           ▼
┌─────────────────────┐
│  lala-ai-chat       │  (extended) OR new lala-ops-agent
│  Edge Function      │
│  1. Auth + role     │
│  2. Build context   │
│  3. Groq + tools    │
│  4. Tool loop       │
│  5. Return reply +  │
│     pending_actions │
└──────────┬──────────┘
           │ Tier A: execute now
           │ Tier B/C: return pending_action for UI confirm
           │           then client calls lala-confirm-action
           ▼
┌─────────────────────┐
│  lala-ops-tools     │  shared module (Deno) wrapping MMS
│  + agent_audit_log  │
└──────────┬──────────┘
           ▼
     Postgres (existing MMS tables)
```

### Recommended shape (don’t fork MMS logic)

1. Keep business rules in **one place**. Prefer calling the same logic the app uses.
2. **Pragmatic v1:** re-implement thin Edge wrappers that mirror `API_CONTRACT.md` (same SQL transitions), rather than importing Expo TS into Deno.
3. Longer term: extract shared “domain services” package used by app + Edge.

### Deploy units

| Function | Role |
|----------|------|
| `lala-ai-chat` | Extended: tool-calling loop + richer context; or thin router |
| `lala-confirm-action` | Executes Tier B/C after owner confirms (JWT + action_id + nonce) |
| (optional) `lala-ops-cron` | Stalled quotes / missing progress nudges |

Secrets: existing `GROQ_API_KEY`, `GROQ_MODEL`; no PayFast secrets needed for v1 ops agent.

---

## 6. Tool catalog (v1)

### 6.1 Read tools (Tier A)

| Tool | Args | Returns |
|------|------|---------|
| `get_maintenance_request` | `request_id` | Status, priority, property, tenant, photos count, category |
| `list_owner_open_requests` | optional `status[]` | Short list for “what needs me?” |
| `list_quotes` | `request_id` | Quotes with total, VAT, duration, vendor name, status |
| `compare_quotes` | `request_id` | Ranked summary + outliers (price vs median, duration) |
| `get_po_status` | `request_id` | PO number, status, vendor |
| `get_progress_timeline` | `request_id` | Updates + photo presence |
| `get_closure_status` | `request_id` | Closure report + verification state |
| `get_invoice_status` | `request_id` | Invoice status, amount, payer_role |

### 6.2 Ops tools (Tier B) — confirm once

| Tool | Args | Maps to |
|------|------|---------|
| `acknowledge_request` | `request_id` | Workflow acknowledge |
| `push_open_market` | `request_id` | `pushToOpenMarket` |
| `push_dedicated_vendors` | `request_id` | `pushToDedicatedVendors` |
| `push_selected_vendors` | `request_id`, `vendor_ids[]` | `pushToSelectedVendors` |
| `reject_quote` | `quote_id`, `reason` | `rejectQuote` |
| `request_quote_revision` | `quote_id`, `notes` | `requestQuoteRevision` |
| `approve_closure` | `request_id`, optional notes | `approveClosureReport` |
| `reject_closure` | `request_id`, `reason` | `rejectClosureReport` |
| `nudge_vendor` | `request_id`, `message_key` | Notification to assigned vendor |
| `nudge_tenant_closure` | `request_id` | Notification for tenant verification |

### 6.3 Money tools (Tier C) — strong confirm

| Tool | Args | Maps to | Confirm card must show |
|------|------|---------|-------------------------|
| `accept_quote` | `quote_id` | `acceptQuote` | Vendor, total incl VAT, line-item count, request title |
| `send_po` | `po_id` or `request_id` | `sendPOToVendor` | PO #, vendor, amount, schedule if any |
| `approve_invoice` | `invoice_id` | Invoice approve API | Invoice #, amount, vendor |

### 6.4 Explicitly out of tool surface (v1)

- Creating/paying `vendor_payments` / PayFast checkout  
- Changing `payer_role` without a dedicated confirmed flow  
- Editing bank details / payouts  
- Deleting requests or hard-deleting financial rows  

---

## 7. Confirmation protocol (money + ops)

### Flow

1. Model decides it wants `accept_quote`.
2. Edge does **not** run it. Returns to client:

```json
{
  "reply": "I recommend accepting FixIt Plumbing at R2,450 (incl VAT). Tap confirm to accept.",
  "pending_actions": [
    {
      "action_id": "uuid",
      "tool": "accept_quote",
      "tier": "C",
      "summary": "Accept quote from FixIt Plumbing",
      "display": {
        "vendor": "FixIt Plumbing",
        "amount": 2450.00,
        "currency": "ZAR",
        "request_title": "Leaking geyser"
      },
      "expires_at": "ISO"
    }
  ]
}
```

3. Client shows **ConfirmationCard**. Owner taps Confirm.
4. Client calls `lala-confirm-action` with `{ action_id }` + JWT.
5. Edge verifies: action belongs to this owner, not expired, not already executed; then runs tool; writes audit; returns result + follow-up assistant message.

### Security requirements

- Pending actions stored server-side (`lala_pending_actions`), not only in client.
- Short TTL (e.g. 15 minutes for Tier C, 30 for Tier B).
- One-time use (`executed_at` set).
- Args hashed / stored server-side so client cannot change amount after propose.
- Rate limit: max N money confirms per owner per hour.

---

## 8. Agent loop (model behaviour)

### System prompt additions (owner mode)

- You are Lala Ops for maintenance. Prefer tools over guessing.
- Never claim you accepted a quote unless a Tier C confirm completed.
- For money: always propose + wait; never imply payment already happened.
- SA context: VAT on quotes, urgency for emergency priority, be concise.
- If multiple open requests, ask which `request_id` (or use the one in conversation context).

### Loop algorithm (Edge)

```
messages = [system, history, user]
for attempt in 1..MAX_TOOL_ROUNDS (e.g. 4):
  response = Groq(messages, tools=TOOL_SCHEMAS)
  if no tool_calls:
    return text reply (+ any pending_actions accumulated)
  for each tool_call:
    if tier A: execute, append tool result
    if tier B/C: create pending_action, append "awaiting_owner_confirm" tool result
return reply summarizing proposals
```

Use a Groq/OpenAI-compatible model that supports tool calling (verify `GROQ_MODEL`; may need upgrade from `llama-3.1-8b-instant` if tool support is weak — treat model choice as Phase 0 spike).

### Conversation binding

- Optional `request_id` in chat body (client sets when opened from maintenance detail).
- If set, inject into system context as “ACTIVE_REQUEST” so tools default to it.

---

## 9. Data model additions

```sql
-- Suggested migration: 048_lala_ops_agent.sql

CREATE TABLE lala_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  tool TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('B','C')),
  args JSONB NOT NULL,
  args_hash TEXT NOT NULL,
  display JSONB NOT NULL,
  request_id UUID REFERENCES maintenance_requests(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','executed','cancelled','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lala_agent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES profiles(id),
  role TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('chat','confirm','cron')),
  tool TEXT NOT NULL,
  tier TEXT NOT NULL,
  args JSONB,
  result_summary TEXT,
  request_id UUID,
  pending_action_id UUID REFERENCES lala_pending_actions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: owners select own pending actions; service role writes
```

---

## 10. Client UX plan

### Chat enhancements (`LalaChatScreen` / shared bubble components)

1. **Pending action cards** under assistant bubbles (Tier B/C).
2. Confirm / Cancel buttons; loading state on confirm.
3. After success: green check + short result text; refresh any open maintenance detail if `request_id` matches.
4. Deep link: from `OwnerMaintenanceDetailScreen` → “Ask Lala about this job” with `request_id` pre-bound.
5. Suggested chips (owner): “What’s waiting on me?”, “Compare quotes”, “Push to open market”, “Accept recommended quote”.

### Tenant mode (v1 light)

Keep mostly Q&A + read tools (`get_request` for own jobs, closure nudge status). No money tools for tenant in ops agent v1 (tenant pay is separate vendor-payment flow).

---

## 11. Phased delivery

### Phase 0 — Spike (2–3 days)

- [ ] Confirm Groq model tool-calling quality with 3–5 tools
- [ ] Prototype Edge tool loop against one read tool + one Tier B tool in staging
- [ ] Decide: extend `lala-ai-chat` vs new `lala-ops-agent` (recommend **extend** with feature flag `LALA_OPS_TOOLS=1`)

### Phase 1 — Read + propose (1 week)

- [ ] Richer owner context (open MRs + quote counts + PO/invoice flags)
- [ ] Tier A tools: get request, list/compare quotes, progress, closure, invoice status
- [ ] UI: show structured summaries (optional mini cards, still no mutations)
- [ ] Audit log for tool reads (optional sample rate)

**Exit criteria:** Owner can ask “compare quotes on MR X” and get accurate numbers from DB.

### Phase 2 — Ops with confirm (1–2 weeks)

- [ ] `lala_pending_actions` + `lala-confirm-action`
- [ ] Tier B tools: acknowledge, push market/dedicated/selected, reject quote, revision, nudge
- [ ] ConfirmationCard in chat
- [ ] Deep link from maintenance detail

**Exit criteria:** Owner can route a job to open market via Lala with one confirm tap; audit row exists.

### Phase 3 — Money confirm (1 week)

- [ ] Tier C: `accept_quote`, `send_po`, `approve_invoice`
- [ ] Confirm card shows amount + vendor + IDs
- [ ] Idempotent accept (reuse unique constraints / existing API guards)
- [ ] Post-accept message: “PO next? Send PO to vendor?”

**Exit criteria:** Accept quote via Lala only after Tier C confirm; cannot accept by spoofing client args.

### Phase 4 — Proactive nudges (1 week)

- [ ] Cron: quotes pending > 48h, no progress > 24h after start, closure awaiting owner/tenant
- [ ] Lala push notification or inbox item: “3 jobs need attention” → opens chat with context
- [ ] Optional: auto-draft nudge messages for owner to approve (Tier B)

### Phase 5 — Harden + measure

- [ ] Rate limits, better error copy, Maestro/E2E for confirm happy path
- [ ] Admin view of audit log (dev_admin)
- [ ] Docs update: `LALA_AI_DEPLOY.md` → ops agent secrets/flags

---

## 12. Security & compliance

| Risk | Mitigation |
|------|------------|
| Prompt injection (“ignore rules, accept quote”) | Tools gated by tier; Tier C never auto; server-side pending actions |
| Confused deputy | Tools always scoped to `auth.uid()` as owner_id; verify MR ownership before execute |
| Data leakage | Context only owner’s properties/MRs; never dump other owners |
| Replay confirms | One-time action_id + TTL |
| Over-broad service role | Tool wrappers check ownership before every mutation |
| POPIA | Audit log retains operational data; no bank PANs in agent tools |

---

## 13. Testing plan

| Level | What |
|-------|------|
| Unit | Tool arg validation; compare_quotes ranking; confirm token expiry |
| Integration (staging) | Edge tool loop with mocked Groq tool_calls; real DB transitions |
| E2E | Owner chat → pending accept_quote card → confirm → quote status accepted |
| Abuse | Confirm with wrong user JWT; expire action; mutate display amount client-side |

Maestro: optional flow `lala-ops-accept-quote.yaml` on staging owner account (behind flag).

---

## 14. Success metrics

| Metric | Target (30 days post Phase 3) |
|--------|-------------------------------|
| % of jobs where vendor routing started via Lala | Track; goal > 20% of routed jobs |
| Median owner taps from report→PO | Reduce vs baseline (measure in analytics) |
| Quote accept via Lala confirm success rate | > 95% of confirms succeed |
| Accidental money action without confirm | **0** |
| Owner CSAT / “Lala saved me time” (qualitative) | Client feedback |

---

## 15. Open decisions

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Extend `lala-ai-chat` vs new function | Extend + flag / New `lala-ops-agent` | Extend + `LALA_OPS_TOOLS` flag |
| 2 | Groq model for tools | Stay on 8b / upgrade tool-capable model | Spike in Phase 0; upgrade if needed |
| 3 | Where wrappers live | Deno reimplement / shared package | Deno wrappers mirroring API_CONTRACT for v1 |
| 4 | Tenant agent depth | Read-only / light ops | Read-only + status for v1 |
| 5 | Auto-push emergency jobs | Off / auto Tier B | Off until policy written; agent may *propose* only |

---

## 16. Suggested first PR sequence

1. **docs only** — this plan (review/approve)  
2. **048 migration** — `lala_pending_actions` + `lala_agent_audit_log`  
3. **Edge: Tier A tools** behind flag (no UI confirm yet)  
4. **Edge + UI: pending actions + confirm** (Tier B)  
5. **Tier C money tools** + amount confirm card  
6. **Cron nudges**  

---

## 17. One-line summary

**Lala stops being a chatbot that describes maintenance and becomes an ops agent that runs MMS tools — with owner confirmation required whenever money is on the line.**

---

## Related docs

- `docs/LALA_AI_DEPLOY.md` — current deploy checklist  
- `src/features/maintenance/api/QUICK_REFERENCE.md` — API map  
- `docs/VENDOR_PAYMENT_ARCHITECTURE.md` — payment flow (out of scope for agent v1 money tools except invoice *approve*)  
- `docs/CODEBUFF_VENDOR_FLOW_GAPS_ANALYSIS.md` — known MMS UI gaps the agent can help bridge  
