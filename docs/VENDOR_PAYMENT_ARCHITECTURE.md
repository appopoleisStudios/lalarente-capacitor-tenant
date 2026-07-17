# Tenant→Vendor Payment Architecture — Uber-like Model

> **Status:** Architecture Design — Final (decisions locked, ready for Phase 1)
> **Date:** July 16, 2026
> **Revised by:** Cursor agent review
> **Decisions locked by:** Product owner (2026-07-16)
> **Applies to:** Tenant→Vendor payment flow (parallel to existing Owner→Vendor flow)

---

## Table of Contents

1. [Business Model](#1-business-model)
2. [Complete Flow Overview](#2-complete-flow-overview)
3. [Money Flow — Single Source of Truth](#3-money-flow--single-source-of-truth)
4. [Payer Exclusivity (Tenant vs Owner)](#4-payer-exclusivity-tenant-vs-owner)
5. [Database Schema](#5-database-schema)
6. [RLS & Security](#6-rls--security)
7. [PayFast Collect + Payout Feasibility](#7-payfast-collect--payout-feasibility)
8. [ITN / Webhooks / Idempotency](#8-itn--webhooks--idempotency)
9. [Progress Tracking & Photo Evidence](#9-progress-tracking--photo-evidence)
10. [Screens to Build](#10-screens-to-build)
11. [API to Build](#11-api-to-build)
12. [Edge Case Handling](#12-edge-case-handling)
13. [VAT / Tax / Legal Notes (SA)](#13-vat--tax--legal-notes-sa)
14. [LaLarente Revenue Dashboard](#14-lalarente-revenue-dashboard)
15. [Build Order](#15-build-order)
16. [Out of Scope for v1](#16-out-of-scope-for-v1)
17. [Open Decisions (Block Phase 1 until answered)](#17-open-decisions-block-phase-1-until-answered)

---

## 1. Business Model

### The Uber Model Applied to Property Maintenance

```
        Tenant pays R1,000 (via PayFast)
                    │
                    ▼
        ┌──────────────────────┐
        │   LaLarente keeps    │──► Platform fee (10% of total)
        │   commission         │
        └──────────────────────┘
                    │
                    ▼
        Vendor receives net payout
        (total − platform_fee − payout_fee)
```

**Key Principles:**
- Tenant pays for the job (not the owner) when this flow is selected
- LaLarente is **merchant of record** for collection (chargebacks / disputes hit LaLarente first)
- LaLarente takes a commission, then pays the vendor
- Owner is informed but does not move money in this flow
- Owner→Vendor and Tenant→Vendor must never both pay the same invoice (see §4)

### Fee Structure (one formula — use everywhere)

| Component | Formula | Who pays | When |
|-----------|---------|----------|------|
| **Invoice total** | Quote/invoice `total_amount` (VAT-inclusive as today) | Tenant | On PayFast success |
| **Platform fee** | `round(total_amount * 0.10, 2)` | Deducted from vendor gross | On completed payment |
| **Gateway fee (PayFast)** | Actual fee from ITN / settlement report (~3.5% + R2) | **LaLarente** (absorbed into platform fee) | Per settled transaction |
| **Payout fee** | Instant R10 / Daily R5 / Weekly R0 | **Vendor** (deducted from vendor payout) | Per payout |
| **Vendor payout** | `total_amount − platform_fee − payout_fee` | — | Calculated at payout time |
| **LaLarente net** | `platform_fee − gateway_fee` | — | After settlement |

**Worked example (weekly payout, free):**

| Line | Amount |
|------|--------|
| Tenant pays | R1,000.00 |
| Platform fee (10%) | R100.00 |
| Gateway fee (~3.5% + R2) | R37.00 (LaLarente cost) |
| Payout fee (weekly) | R0.00 |
| Vendor receives | R900.00 |
| LaLarente net | R63.00 |

**Worked example (instant payout):**

| Line | Amount |
|------|--------|
| Tenant pays | R1,000.00 |
| Platform fee | R100.00 |
| Payout fee (instant) | R10.00 |
| Vendor receives | R890.00 |
| LaLarente net | `platform_fee − gateway_fee` (gateway still LaLarente cost) |

Do **not** subtract gateway fee from vendor payout. Gateway fee only affects LaLarente net.

---

## 2. Complete Flow Overview

### The Full 9-Stage Lifecycle

```
STAGE 1:  Tenant reports issue + uploads photos
STAGE 2:  Vendors submit quotes with line items
STAGE 3:  Owner approves quote + selects vendor
STAGE 4:  Vendor does work + submits progress with photos
STAGE 5:  Two-sided closure (vendor + tenant confirm with photos)
STAGE 6:  Vendor submits invoice
STAGE 7:  Tenant pays via PayFast (money lands with LaLarente)
STAGE 8:  LaLarente splits: keep commission, send vendor payout
STAGE 9:  Job complete, funds settled, receipt generated
```

### Progress bar labels (aligned with stages)

```
1 Report → 2 Quote → 3 Approve → 4 Work → 5 Close → 6 Invoice → 7 Pay → 8 Payout → 9 Done
```

### What already exists in this repo

| Piece | Status | Notes |
|-------|--------|-------|
| Tenant report + media upload | Built | `useMediaUpload`, maintenance report |
| Vendor quotes | Built | `VendorQuoteSubmitScreen` |
| Owner approve / PO | Built | Existing owner flow |
| Maintenance invoices | Built | `maintenance_invoices` (migration 044) |
| Closure / tenant verification | Built | `closure_reports` (migration 018) — **extend, do not invent a parallel table** |
| PayFast config stubs | Partial | `paymentGateway.ts`, webhook fn — extend for vendor payments |
| Job progress updates | Built | Extend with required photos + geo |

### Detailed Stage Breakdown

```
STAGE 1 — REPORT (Tenant) — already built
STAGE 2 — QUOTE (Vendor) — already built
STAGE 3 — APPROVE (Owner) — already built; also set payer_role = tenant|owner
STAGE 4 — WORK (Vendor) — extend: mandatory photo(s) + optional geo
STAGE 5 — CLOSURE (Vendor + Tenant) — extend closure_reports
          Edge: tenant silent → auto-escalate or auto-approve (see §17)
STAGE 6 — INVOICE (Vendor) — already built
STAGE 7 — TENANT PAYS (new) — PayFast hosted + ITN webhook
STAGE 8 — SPLIT + PAYOUT (new) — ledger + payout adapter (PayFast or manual EFT)
STAGE 9 — DONE + RECEIPT (new) — PDF + notifications; rating optional / v2
```

---

## 3. Money Flow — Single Source of Truth

```
TENANT BANK
    │  PayFast hosted checkout (R1,000)
    ▼
LALARENTE MERCHANT ACCOUNT (PayFast)
    │  ITN confirms COMPLETE
    ▼
vendor_payments row
  total_amount   = 1000.00
  platform_fee   = 100.00
  gateway_fee    = 37.00   (from ITN / settlement; LaLarente cost)
  payout_fee     = 0|5|10  (set when payout schedule chosen)
  vendor_payout  = total − platform_fee − payout_fee
  net_revenue    = platform_fee − gateway_fee
    │
    ▼
PAYOUT ADAPTER (see §7)
    │  send vendor_payout to vendor bank
    ▼
VENDOR BANK
```

### Balance sheet (weekly payout, gateway absorbed by LaLarente)

| Event | Tenant | LaLarente | Vendor | PayFast |
|-------|--------|-----------|--------|---------|
| Before | R10,000 | R5,000 | R2,000 | — |
| Tenant pays R1,000 | −R1,000 | — | — | +R1,000 (float) |
| Settled to LaLarente | — | +R1,000 | — | −R1,000 |
| Gateway fee taken | — | −R37 | — | +R37 |
| Payout R900 to vendor | — | −R900 | +R900 | — |
| **Final** | **R9,000** | **R5,063** | **R2,900** | **+R37** |

Platform fee is an accounting allocation of the R1,000, not a second charge to the tenant.

### Payout schedule options

| Option | Timing | Payout fee | Default |
|--------|--------|------------|---------|
| Instant | Same business day (if adapter supports) | R10 | No |
| Daily | Next business day | R5 | No |
| Weekly | Every Monday for previous week | R0 | **Yes** |

Store preference in `vendor_payout_preferences` (see §5).

### State machines

**payment_status**

```
pending → processing → completed
pending → processing → failed
pending → cancelled          (tenant abandoned PayFast)
completed → refunded         (admin / dispute)
failed → pending             (retry creates new attempt — see uniqueness rules)
```

**payout_status**

```
pending → processing → sent
pending → processing → failed → pending   (after bank details fixed)
pending → on_hold                         (dispute)
on_hold → pending | cancelled
sent → (terminal)
```

---

## 4. Payer Exclusivity (Tenant vs Owner)

Owner→Vendor and Tenant→Vendor must not both pay the same invoice.

### Rule

On quote approval / invoice approval, set:

- `maintenance_invoices.payer_role` = `'tenant' | 'owner'`
- Optional override by owner before first successful payment

### Enforcement

1. If `payer_role = 'owner'` → tenant Pay UI hidden; owner uses existing pay flow
2. If `payer_role = 'tenant'` → owner pay UI blocked for that invoice
3. DB: partial unique index so at most one **active** collection payment exists per invoice
4. Webhook rejects ITN if invoice already `paid` or another `completed` vendor_payment exists

---

## 5. Database Schema

> Next migration: `047_create_vendor_payment_system.sql`  
> Depends on: `044_create_maintenance_invoices.sql`, `018_add_tenant_verification_to_closure.sql`, existing `job_progress_updates`, `payments` / PayFast webhook paths.

### Extend: maintenance_invoices

```sql
ALTER TABLE maintenance_invoices
  ADD COLUMN IF NOT EXISTS payer_role TEXT NOT NULL DEFAULT 'owner';

ALTER TABLE maintenance_invoices
  DROP CONSTRAINT IF EXISTS maintenance_invoices_payer_role_check;

ALTER TABLE maintenance_invoices
  ADD CONSTRAINT maintenance_invoices_payer_role_check
    CHECK (payer_role IN ('tenant', 'owner'));
```

Default `'owner'` preserves current Owner→Vendor behaviour. Tenant→Vendor jobs set `'tenant'` at approval.

### New: vendor_payments

```sql
CREATE TABLE vendor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  invoice_id UUID NOT NULL REFERENCES maintenance_invoices(id) ON DELETE RESTRICT,
  maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests(id),
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  vendor_id UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),

  -- FINANCIALS (cents-safe DECIMAL; formulas in §1)
  total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount > 0),
  platform_fee DECIMAL(12,2) NOT NULL CHECK (platform_fee >= 0),
  platform_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  gateway_fee DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (gateway_fee >= 0),
  payout_fee DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (payout_fee >= 0),
  vendor_payout DECIMAL(12,2) NOT NULL CHECK (vendor_payout >= 0),
  net_revenue DECIMAL(12,2) GENERATED ALWAYS AS (platform_fee - gateway_fee) STORED,

  -- Fee integrity: vendor_payout must equal total - platform_fee - payout_fee
  CONSTRAINT vp_fee_integrity
    CHECK (vendor_payout = total_amount - platform_fee - payout_fee),

  -- GATEWAY
  payment_gateway TEXT NOT NULL DEFAULT 'payfast'
    CHECK (payment_gateway IN ('payfast', 'yoco', 'manual')),
  gateway_transaction_id TEXT,           -- pf_payment_id (idempotency)
  gateway_response JSONB,
  idempotency_key TEXT,                  -- client/server attempt key

  -- PAYMENT STATUS
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','processing','completed','failed','cancelled','refunded')),
  paid_at TIMESTAMPTZ,

  -- PAYOUT STATUS
  payout_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payout_status IN ('pending','processing','sent','failed','cancelled','on_hold')),
  payout_method TEXT NOT NULL DEFAULT 'manual_eft'
    CHECK (payout_method IN ('payfast_payout','manual_eft','instant')),
  payout_initiated_at TIMESTAMPTZ,
  payout_completed_at TIMESTAMPTZ,
  payout_reference TEXT,

  -- DISPUTE
  dispute_status TEXT NOT NULL DEFAULT 'none'
    CHECK (dispute_status IN ('none','opened','resolved','escalated')),
  dispute_resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one completed payment per invoice
CREATE UNIQUE INDEX uq_vp_invoice_completed
  ON vendor_payments (invoice_id)
  WHERE payment_status = 'completed';

-- At most one in-flight attempt per invoice
CREATE UNIQUE INDEX uq_vp_invoice_inflight
  ON vendor_payments (invoice_id)
  WHERE payment_status IN ('pending', 'processing');

-- Idempotent ITN
CREATE UNIQUE INDEX uq_vp_gateway_tx
  ON vendor_payments (payment_gateway, gateway_transaction_id)
  WHERE gateway_transaction_id IS NOT NULL;

-- Idempotent checkout creation
CREATE UNIQUE INDEX uq_vp_idempotency_key
  ON vendor_payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Idempotent ITN
CREATE UNIQUE INDEX uq_vp_gateway_tx
  ON vendor_payments (payment_gateway, gateway_transaction_id)
  WHERE gateway_transaction_id IS NOT NULL;

CREATE INDEX idx_vp_invoice ON vendor_payments(invoice_id);
CREATE INDEX idx_vp_vendor ON vendor_payments(vendor_id);
CREATE INDEX idx_vp_tenant ON vendor_payments(tenant_id);
CREATE INDEX idx_vp_status ON vendor_payments(payment_status, payout_status);
CREATE INDEX idx_vp_created ON vendor_payments(created_at);
```

Failed attempts remain as historical rows; a **new** `pending` row is created for retry (after prior pending/processing is cancelled or failed).

### New: vendor_payment_ledger

```sql
CREATE TYPE vendor_ledger_entry_type AS ENUM (
  'payment_received',
  'platform_fee',
  'gateway_fee',
  'payout_sent',
  'payout_fee',
  'refund',
  'dispute_hold',
  'dispute_release'
);

CREATE TABLE vendor_payment_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_payment_id UUID NOT NULL REFERENCES vendor_payments(id) ON DELETE CASCADE,
  entry_type vendor_ledger_entry_type NOT NULL,
  amount DECIMAL(12,2) NOT NULL,  -- + inflow to LaLarente books / − outflow
  running_balance DECIMAL(12,2) NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vp_ledger ON vendor_payment_ledger(vendor_payment_id);
```

### Extend: closure_reports (prefer over new closure_verifications)

Reuse `closure_reports` from migration 018. Add only what is missing for two-sided photo closure:

```sql
ALTER TABLE closure_reports
  ADD COLUMN IF NOT EXISTS vendor_after_photos TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vendor_closure_notes TEXT,
  ADD COLUMN IF NOT EXISTS vendor_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tenant_confirmation_photos TEXT[] DEFAULT '{}';
  -- tenant_notes / tenant verification fields already exist in 018
```

Only introduce a separate `closure_verifications` table if product decides to decouple from `closure_reports` entirely (not recommended for v1).

### Extend: job_progress_updates

> **Note:** `job_progress_updates` already has a `photos` column (TEXT[]). Only geo-location columns are new.

```sql
ALTER TABLE job_progress_updates
  ADD COLUMN IF NOT EXISTS geo_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS geo_lng DECIMAL(10,7);
```

App rule: reject progress submit if `photos` is empty.

### New: vendor_payout_preferences

```sql
CREATE TABLE vendor_payout_preferences (
  vendor_id UUID PRIMARY KEY REFERENCES profiles(id),
  schedule TEXT NOT NULL DEFAULT 'weekly'
    CHECK (schedule IN ('instant','daily','weekly')),
  bank_account_name TEXT,
  bank_name TEXT,
  branch_code TEXT,
  account_number_encrypted TEXT,  -- never store raw PAN in app logs
  account_type TEXT CHECK (account_type IN ('cheque','savings','transmission')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 6. RLS & Security

All money tables require RLS before any client write path is enabled.

### vendor_payments

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Tenant (own `tenant_id`) | Yes | No (Edge Function only) | No |
| Vendor (own `vendor_id`) | Yes (no gateway secrets) | No | No |
| Owner (own `owner_id`) | Yes (summary fields) | No | No |
| Service role / Edge | Yes | Yes | Yes |
| Admin (`dev_admin` flag) | Yes | No (via Edge) | Yes |

Hide `gateway_response` raw payloads from clients; expose sanitized status fields via views or API.

### vendor_payment_ledger

- SELECT: admin + service role only (vendors see aggregated earnings API, not raw ledger)
- INSERT: service role only

### closure_reports / progress photos

- Existing RLS for tenants/vendors/owners; extend for new photo columns
- Photos in Storage bucket with path scoped to `maintenance_request_id`
- Signed URLs only; no public buckets

### Secrets

- PayFast passphrase / merchant key: Edge Functions + Doppler / env only
- Never ship passphrase in Expo client

---

## 7. PayFast Collect + Payout Feasibility

### Collection (confirmed direction)

- Use existing PayFast hosted checkout + ITN pattern (see `paymentGateway.ts` / `payment-webhook`)
- Money lands in LaLarente merchant account
- LaLarente is merchant of record

### Payouts (must validate before coding Phase 4)

PayFast’s product surface for **merchant → vendor bank payouts** is account-type dependent. Treat payout as an **adapter**:

| Adapter | When to use |
|---------|-------------|
| `payfast_payout` | Only if merchant account + API confirmed for automated EFT payouts |
| `manual_eft` | Ops exports weekly batch CSV / EFT from banking (v1-safe fallback) |
| `instant` | Only if provider supports same-day; else queue next business day |

**Phase 1–2 can ship tenant collect without automated payout.** Mark `payout_status = 'pending'` and settle via weekly manual batch until adapter is live.

### Sandbox checklist

- [ ] PayFast sandbox merchant ID / key / passphrase in Mac mini + Edge env
- [ ] ITN URL reachable (ngrok / deployed function)
- [ ] Signature validation unit tests
- [ ] Confirm whether payout API exists for this merchant (document result in this file)

---

## 8. ITN / Webhooks / Idempotency

### Invariants

1. Verify PayFast signature on every ITN
2. Idempotency key = `(payment_gateway, pf_payment_id)` unique index
3. Amount on ITN must equal `vendor_payments.total_amount` (else fail + alert)
4. Invoice must have `payer_role = 'tenant'` and status allowing pay
5. Transition only: `pending|processing` → `completed|failed|cancelled`

### Flow

```
Tenant taps Pay
  → Edge creates vendor_payments (pending) + PayFast form fields
  → Tenant completes hosted page
  → ITN hits payment-webhook
  → Verify signature + amount + idempotency
  → Set completed, write ledger (payment_received, platform_fee, gateway_fee)
  → Set invoice status paid
  → Notify vendor / owner / admin
  → Enqueue payout (pending)
```

### If ITN never arrives

- Client polls Edge `getVendorPaymentStatus(paymentId)` for up to 5 minutes
- Reconciliation cron (hourly): query PayFast query API for stuck `processing` rows older than 15 minutes

---

## 9. Progress Tracking & Photo Evidence

### Progress bar (all parties)

```
●●●●●●○○○  Stage 6 of 9 — Invoice
1 Report ✅  2 Quote ✅  3 Approve ✅  4 Work ✅  5 Close ✅  6 Invoice 🔄  7 Pay ⬜  8 Payout ⬜  9 Done ⬜
```

### Photo requirements

| Stage | Required photos | Who | If missing |
|-------|-----------------|-----|------------|
| 1 Report | 1–5 of issue | Tenant | Cannot submit |
| 4 Work | 1+ per progress update | Vendor | Cannot submit update |
| 5 Close | 2+ after photos | Vendor | Cannot request closure |
| 5 Close | 2+ confirmation photos | Tenant | Escalate after timeout (see §17) |

---

## 10. Screens to Build

| # | Screen | Route | Purpose | Priority |
|---|--------|-------|---------|----------|
| 1 | Tenant Vendor Payments List | `/(tenant)/vendor-payments` | Approved invoices awaiting tenant pay | P0 |
| 2 | Tenant Pay Vendor | `/(tenant)/vendor-payments/[invoiceId]` | Breakdown + Pay via PayFast | P0 |
| 3 | Tenant Payment Result | `/(tenant)/vendor-payments/result` | Success / failure return URL | P0 |
| 4 | Closure Confirmation | `/(tenant)/maintenance/[id]/closure-confirm` | Tenant confirmation photos | P0 |
| 5 | Vendor Earnings | `/(vendor)/earnings` | History, pending, totals | P0 |
| 6 | Vendor Bank Details | `/(vendor)/earnings/banking` | Payout destination | P0 |
| 7 | Admin: Payments | Admin panel | Revenue + txs + disputes | P1 |
| 8 | Admin: Manual Payout | Admin panel | Trigger / mark batch sent | P1 |

---

## 11. API to Build

| # | Function | Purpose | Priority |
|---|----------|---------|----------|
| 1 | `createVendorPaymentCheckout()` | Create pending `vendor_payments`, return PayFast fields | P0 |
| 2 | `handleVendorPaymentITN()` | Webhook: signature, idempotency, complete payment | P0 |
| 3 | `getVendorPaymentStatus()` | Poll after return URL | P0 |
| 4 | `getVendorEarnings()` | Vendor earnings summary | P0 |
| 5 | `confirmClosureWithPhotos()` | Extend closure_reports two-sided confirm | P0 |
| 6 | `getProgressTimeline()` | Extend existing timeline with photos | P0 |
| 7 | `initiatePayout()` / `processPayoutBatch()` | Adapter: PayFast or manual_eft | P1 |
| 8 | `disputeHoldPayment()` | Set payout `on_hold` | P1 |
| 9 | `getLaLarenteRevenue()` | Admin metrics | P1 |

Client apps call Edge Functions for create checkout / status; no direct INSERT into `vendor_payments` from the device.

---

## 12. Edge Case Handling

### Payment

| Scenario | Action |
|----------|--------|
| PayFast failed | `payment_status = failed`; tenant retries (new pending row) |
| Tenant cancels hosted page | `cancelled` or leave `pending` until TTL cancel job |
| ITN missing | Poll + reconciliation cron |
| Duplicate ITN | Unique on `gateway_transaction_id` → ignore |
| Amount mismatch | Fail + admin alert; do not mark completed |
| Invoice already paid | Reject ITN |
| Gateway down | UX: try again later |

### Payout

| Scenario | Action |
|----------|--------|
| Wrong bank details | `payout_status = failed`; vendor updates banking |
| Insufficient merchant balance | Keep pending; alert admin |
| Instant outside hours | Queue next business day |
| Bank change mid-flight | Original destination wins once sent |

### Dispute / closure

| Scenario | Action |
|----------|--------|
| Tenant refuses closure | `dispute_status = opened`; payout `on_hold` |
| Tenant silent past timeout | Escalate to admin **or** auto-approve (config — §17) |
| Vendor silent on dispute 7d | Prefer refund path after admin review (not fully automatic in v1) |
| Partial / full refund | Admin-only via PayFast refund API; ledger `refund` entries |

---

## 13. VAT / Tax / Legal Notes (SA)

- Invoice `total_amount` already includes VAT at 15% in maintenance invoices — keep that model
- Platform fee is calculated on **VAT-inclusive total** unless finance decides otherwise (document decision in §17)
- LaLarente must issue tax invoices for platform fees where required (finance process; not in-app v1)
- Merchant of record = LaLarente for PayFast collection → chargebacks / Section 44 ECTA style consumer issues land on LaLarente
- POPIA: bank details encrypted at rest; minimize retention; no logging of full account numbers
- CPA: clear fee disclosure to vendor before they accept work on Tenant→Vendor jobs

---

## 14. LaLarente Revenue Dashboard

P1 after collect path works. Metrics:

- Gross collected, platform fees, gateway fees, net revenue
- Pending payouts total
- Dispute rate, photo compliance, avg completion time

Notifications (high signal only for v1):

| Event | Who |
|-------|-----|
| Closure needs tenant confirm | Tenant |
| Payment completed | Vendor, Owner, Admin |
| Payout sent / failed | Vendor (+ Admin on fail) |
| Dispute opened | Admin |

---

## 15. Build Order

### Phase 1: Foundation

| # | Task | Depends on |
|---|------|------------|
| 1 | Migration 047: `vendor_payments`, ledger, payout prefs, invoice `payer_role`, closure/progress columns + RLS | Existing 044 / 018 |
| 2 | TS types | Migration |
| 3 | Edge: create checkout + ITN handler (idempotent) | Types + PayFast sandbox |
| 4 | Closure photo API extending `closure_reports` | Migration |

### Phase 2: Tenant pay UI

| # | Task |
|---|------|
| 5 | List + pay + result screens |
| 6 | Wire return URL + status poll |
| 7 | Maestro smoke: pay happy path (sandbox) |

### Phase 3: Closure evidence

| # | Task |
|---|------|
| 8 | Tenant closure-confirm screen |
| 9 | Require photos on vendor progress |

### Phase 4: Payout + earnings

| # | Task |
|---|------|
| 10 | Vendor earnings + banking |
| 11 | Payout adapter (`manual_eft` first, then PayFast if feasible) |
| 12 | Batch cron / admin “mark paid” |

### Phase 5: Admin

| # | Task |
|---|------|
| 13 | Revenue dashboard, disputes, manual payout |

### Phase 6: Polish

| # | Task |
|---|------|
| 14 | Auto-escalation cron, receipts PDF, retry nudges, E2E suite |

---

## 16. Out of Scope for v1

- In-app vendor star ratings UI
- Yoco as second gateway
- Partial-refund self-serve UI (admin-only is enough)
- Instant payout unless provider confirmed
- Separate `closure_verifications` table (use `closure_reports`)
- Full tax-invoice generation for SARS inside the app

---

## 17. Open Decisions (Locked)

1. **PayFast payout API:** available for this merchant, or v1 = `manual_eft` only?
2. **Closure timeout policy:** auto-approve (like existing 72h on `closure_reports`) vs admin escalate only?
3. **Platform fee VAT:** fee on VAT-inclusive total, or exclusive?
4. **Default `payer_role`:** stay `owner` until owner toggles Tenant pays, or new jobs default to tenant?
5. **Who may open disputes:** tenant only, or owner too?

Record answers here when decided:

| # | Decision | Answer | Date |
|---|----------|--------|------|
| 1 | Payout adapter | **manual_eft v1** — Phase 1-4 use manual batch EFT. Research PayFast payout API in parallel during Phase 1-2. If available, upgrade to automated Phase 4+. | 2026-07-16 |
| 2 | Closure timeout | **Auto-approve after 72h** — matches existing closure_reports default. Tenant has 3 days to respond, then work auto-accepted. | 2026-07-16 |
| 3 | Fee VAT base | **VAT-inclusive total** — platform fee calculated on total tenant sees (e.g., 10% of R1,000 incl VAT = R100). Simpler UX, higher net revenue. | 2026-07-16 |
| 4 | Default payer_role | **Owner** — stay with existing behavior. New jobs default to Owner-pays. Owner explicitly toggles to Tenant-pays. Zero disruption. | 2026-07-16 |
| 5 | Dispute openers | **Tenant only** — clean separation of flows. Owner handles disputes in Owner→Vendor flow; tenant handles disputes in Tenant→Vendor flow. | 2026-07-16 |

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-16 | Initial architecture draft |
| 2026-07-16 | Cursor revision: single fee formula, payer exclusivity, RLS, ITN idempotency, PayFast payout feasibility, reuse `closure_reports`, fix uniqueness, VAT/legal notes, open decisions |
