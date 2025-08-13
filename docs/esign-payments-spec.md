# E‑Signature Contracts & Payments Notifications/Records

Date: 2025-08-13  
Status: Draft for Review

---

## Goals
- Paperless rental contracts (web/mobile) with easy e‑signing.
- Trusted, immutable signed artifacts and audit trail.
- Notifications for payments and complete payment records.

## E‑Signature Workflow
1. Draft contract from template with merge fields (tenant, property, rent, dates).
2. Present review screen; collect signatures:
   - Tenant signature (touch/mouse), Owner signature.
   - Initials for key clauses; checkbox consents.
3. Generate finalized PDF:
   - Embed signature images + signer metadata.
   - Hash file (SHA-256) and store hash in DB for tamper detection.
   - Store PDF in Supabase Storage; keep metadata in `contracts`.
4. Record audit trail:
   - Events: created, viewed, signed_by_tenant, signed_by_owner, finalized.
   - Include timestamp, IP, user agent, actor id.

## Proposed Schema
```sql
-- Contracts
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','pending_signatures','partially_signed','signed','void')),
  pdf_url TEXT,                -- storage path
  pdf_sha256 TEXT,             -- tamper-proofing
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Signatures captured as images with metadata
CREATE TABLE contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  signer_role TEXT NOT NULL CHECK (signer_role IN ('tenant','owner')),
  signer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  signature_image_url TEXT NOT NULL, -- storage path
  signed_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  user_agent TEXT
);

-- Audit trail
CREATE TABLE contract_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  event TEXT NOT NULL, -- created, viewed, signed_by_tenant, etc.
  actor_id UUID REFERENCES profiles(id),
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contracts_parties ON contracts(owner_id, tenant_id);
CREATE INDEX idx_contract_logs_contract ON contract_audit_logs(contract_id, created_at DESC);
```

## RLS (outline)
- `contracts`: tenant, owner, and admins can read; only owner/admin can create; signatures restricted to assigned signer.
- `contract_signatures`: read limited to parties; insert limited to signer.
- `contract_audit_logs`: read limited to parties; insert via RPC.

## Storage
- Bucket: `contracts`
  - Folder per contract: `contracts/{contract_id}/final.pdf`, `signatures/{signature_id}.png`
  - Use signed URLs for access.

## UI Flow
- Route: `/contracts/new?lease={id}` → build from lease.
- Capture components: signature pad, initials, consent checkboxes.
- Preview → Sign → Finalize → Show PDF with verify hash.

## Payment Notifications & Records

### Notifications
- Rent due, overdue, received, failed.
- Lease-specific cadence (due_date + grace_period).
- Channels: in-app, email, SMS (pluggable).

### Records
- `payments` already stores commission/net fields.
- Add fields: `due_date`, `grace_period_days`, `receipt_url`, `receipt_number`.
- Generate receipts as PDFs on successful payment and store in `receipts` bucket.

```sql
ALTER TABLE payments 
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS receipt_number TEXT;
```

## RPCs
```sql
-- Create and finalize contract
CREATE OR REPLACE FUNCTION rpc_finalize_contract(p_contract_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  -- generate PDF (Edge Function or server), compute sha256, update row
  UPDATE contracts
  SET status = 'signed', updated_at = now()
  WHERE id = p_contract_id;

  INSERT INTO contract_audit_logs(contract_id, event, data)
  VALUES (p_contract_id, 'finalized', json_build_object('source','rpc'));
END; $$;

-- Send rent due notifications (called daily)
CREATE OR REPLACE FUNCTION rpc_send_rent_due_notifications()
RETURNS INTEGER LANGUAGE sql AS $$
  WITH due AS (
    SELECT p.id as payment_id, p.tenant_id
    FROM payments p
    WHERE p.status = 'pending'
      AND p.due_date = CURRENT_DATE + INTERVAL '3 days'
  )
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT tenant_id, 'payment', 'Rent Due Soon', 'Your rent is due in 3 days.', json_build_object('payment_id', payment_id)
  FROM due
  RETURNING 1;
$$;
```

## Compliance & Audit
- Store `pdf_sha256` for tamper detection.
- Keep signer IP and user agent in signatures.
- Immutable audit trail in `contract_audit_logs` (no updates; only inserts).

## Open Questions
- Preferred signature provider (native vs external like DocuSign/Zoho Sign)?
- Jurisdictional legal wording required for e-sign validity?
- SMS provider preference for notifications?

