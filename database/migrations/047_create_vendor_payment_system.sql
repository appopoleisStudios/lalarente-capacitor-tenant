-- ============================================================
-- MIGRATION 047: Vendor Payment System (Tenant→Vendor Flow)
-- ============================================================
-- Creates the complete data layer for the Uber-like Tenant→Vendor
-- payment system that runs parallel to the existing Owner→Vendor flow.
--
-- Key decisions (2026-07-16):
--   - Payout adapter: manual_eft v1 (research PayFast payout in parallel)
--   - Closure timeout: Auto-approve after 72h
--   - Fee VAT base: VAT-inclusive total
--   - Default payer_role: Owner (existing default preserved)
--   - Dispute openers: Tenant only
--
-- Dependencies: migrations 044, 018, 007 (payments table)
-- ============================================================

-- ============================================================
-- PART 1: EXTEND EXISTING TABLES
-- ============================================================

-- 1a. Extend maintenance_invoices with payer_role
-- Use named constraint so re-runs are predictable (can DROP + re-ADD)
ALTER TABLE maintenance_invoices
  ADD COLUMN IF NOT EXISTS payer_role TEXT NOT NULL DEFAULT 'owner';

-- Safely add/replace the CHECK constraint by name
ALTER TABLE maintenance_invoices
  DROP CONSTRAINT IF EXISTS maintenance_invoices_payer_role_check;

ALTER TABLE maintenance_invoices
  ADD CONSTRAINT maintenance_invoices_payer_role_check
    CHECK (payer_role IN ('tenant', 'owner'));

COMMENT ON COLUMN maintenance_invoices.payer_role IS
  'Who pays for this invoice: owner (existing flow) or tenant (Uber-like flow).
   Default is owner to preserve existing behaviour.';

-- 1b. Extend closure_reports for two-sided photo closure
ALTER TABLE closure_reports
  ADD COLUMN IF NOT EXISTS vendor_after_photos TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vendor_closure_notes TEXT,
  ADD COLUMN IF NOT EXISTS vendor_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tenant_confirmation_photos TEXT[] DEFAULT '{}';

COMMENT ON COLUMN closure_reports.vendor_after_photos IS
  'Vendor-uploaded photos of completed work (Tenant→Vendor flow).';
COMMENT ON COLUMN closure_reports.vendor_closure_notes IS
  'Vendor notes when requesting closure (Tenant→Vendor flow).';
COMMENT ON COLUMN closure_reports.vendor_confirmed_at IS
  'Timestamp when vendor confirmed work done and requested closure.';
COMMENT ON COLUMN closure_reports.tenant_confirmation_photos IS
  'Tenant-uploaded confirmation photos (Tenant→Vendor flow).
   Separate from tenant_rejection_photos which are for rejections.';

-- 1c. Extend job_progress_updates with geo-location
-- (photos column already exists — no need to add photo_urls)
ALTER TABLE job_progress_updates
  ADD COLUMN IF NOT EXISTS geo_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS geo_lng DECIMAL(10,7);

COMMENT ON COLUMN job_progress_updates.geo_lat IS
  'Latitude of progress update location (optional geotagging for evidence).';
COMMENT ON COLUMN job_progress_updates.geo_lng IS
  'Longitude of progress update location (optional geotagging for evidence).';

-- ============================================================
-- PART 2: NEW TABLES
-- ============================================================

-- 2a. vendor_payments — Core transaction table
CREATE TABLE IF NOT EXISTS vendor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  invoice_id UUID NOT NULL REFERENCES maintenance_invoices(id) ON DELETE RESTRICT,
  maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  vendor_id UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),

  -- FINANCIALS (cents-safe DECIMAL)
  total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount > 0),
  platform_fee DECIMAL(12,2) NOT NULL CHECK (platform_fee >= 0),
  platform_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  gateway_fee DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (gateway_fee >= 0),
  payout_fee DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (payout_fee >= 0),
  vendor_payout DECIMAL(12,2) NOT NULL CHECK (vendor_payout >= 0),
  -- net_revenue = platform_fee - gateway_fee (generated column)
  net_revenue DECIMAL(12,2) GENERATED ALWAYS AS (platform_fee - gateway_fee) STORED,

  -- Fee integrity: vendor_payout must equal total - platform_fee - payout_fee
  CONSTRAINT vp_fee_integrity
    CHECK (vendor_payout = total_amount - platform_fee - payout_fee),

  -- GATEWAY
  payment_gateway TEXT NOT NULL DEFAULT 'payfast'
    CHECK (payment_gateway IN ('payfast', 'yoco', 'manual')),
  gateway_transaction_id TEXT,
  gateway_response JSONB,
  idempotency_key TEXT,

  -- PAYMENT STATUS
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN (
      'pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'
    )),
  paid_at TIMESTAMPTZ,

  -- PAYOUT STATUS
  payout_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payout_status IN (
      'pending', 'processing', 'sent', 'failed', 'cancelled', 'on_hold'
    )),
  -- Default to manual_eft for v1 (PayFast payout API TBD)
  payout_method TEXT NOT NULL DEFAULT 'manual_eft'
    CHECK (payout_method IN ('payfast_payout', 'manual_eft', 'instant')),
  payout_initiated_at TIMESTAMPTZ,
  payout_completed_at TIMESTAMPTZ,
  payout_reference TEXT,

  -- DISPUTE
  dispute_status TEXT NOT NULL DEFAULT 'none'
    CHECK (dispute_status IN ('none', 'opened', 'resolved', 'escalated')),
  dispute_resolved_at TIMESTAMPTZ,

  -- TIMESTAMPS
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique indexes for data integrity

-- At most one completed payment per invoice (no double payment)
CREATE UNIQUE INDEX IF NOT EXISTS uq_vp_invoice_completed
  ON vendor_payments (invoice_id)
  WHERE payment_status = 'completed';

-- At most one in-flight attempt per invoice
CREATE UNIQUE INDEX IF NOT EXISTS uq_vp_invoice_inflight
  ON vendor_payments (invoice_id)
  WHERE payment_status IN ('pending', 'processing');

-- Idempotent ITN processing (same gateway txn won't be applied twice)
CREATE UNIQUE INDEX IF NOT EXISTS uq_vp_gateway_tx
  ON vendor_payments (payment_gateway, gateway_transaction_id)
  WHERE gateway_transaction_id IS NOT NULL;

-- Idempotent checkout creation (same idempotency_key prevents duplicate attempts)
CREATE UNIQUE INDEX IF NOT EXISTS uq_vp_idempotency_key
  ON vendor_payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_vp_invoice ON vendor_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_vp_vendor ON vendor_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vp_tenant ON vendor_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vp_owner ON vendor_payments(owner_id);
CREATE INDEX IF NOT EXISTS idx_vp_status ON vendor_payments(payment_status, payout_status);
CREATE INDEX IF NOT EXISTS idx_vp_created ON vendor_payments(created_at);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_vendor_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vendor_payments_updated_at
  BEFORE UPDATE ON vendor_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_payments_updated_at();

COMMENT ON TABLE vendor_payments IS
  'Core transaction table for Tenant→Vendor payment flow.
   Tracks the full lifecycle from payment creation through
   PayFast collection, platform fee deduction, and vendor payout.
   Parallel to the existing Owner→Vendor payment flow via payments table.';

-- 2b. vendor_payment_ledger — Journal/audit trail
DO $$ BEGIN
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
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS vendor_payment_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_payment_id UUID NOT NULL REFERENCES vendor_payments(id) ON DELETE CASCADE,

  entry_type vendor_ledger_entry_type NOT NULL,
  amount DECIMAL(12,2) NOT NULL,  -- Positive = inflow to LaLarente, Negative = outflow
  running_balance DECIMAL(12,2) NOT NULL,

  description TEXT,
  reference_id TEXT,
  created_by UUID REFERENCES profiles(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vp_ledger_payment ON vendor_payment_ledger(vendor_payment_id);
CREATE INDEX IF NOT EXISTS idx_vp_ledger_type ON vendor_payment_ledger(entry_type);
CREATE INDEX IF NOT EXISTS idx_vp_ledger_created ON vendor_payment_ledger(created_at);

COMMENT ON TABLE vendor_payment_ledger IS
  'Immutable journal/audit trail for every financial event in the
   Tenant→Vendor payment lifecycle. Each entry_type has a fixed meaning:
   - payment_received: +amount (tenant paid via PayFast)
   - platform_fee: -amount (LaLarente commission)
   - gateway_fee: -amount (PayFast transaction fee)
   - payout_sent: -amount (vendor payout disbursed)
   - payout_fee: -amount (instant/daily payout fee charged)
   - refund: -amount (money returned to tenant)
   - dispute_hold: -amount (funds frozen during dispute)
   - dispute_release: +amount (held funds released to vendor)';

-- 2c. vendor_payout_preferences — Vendor bank details
CREATE TABLE IF NOT EXISTS vendor_payout_preferences (
  vendor_id UUID PRIMARY KEY REFERENCES profiles(id),

  -- Payout schedule
  schedule TEXT NOT NULL DEFAULT 'weekly'
    CHECK (schedule IN ('instant', 'daily', 'weekly')),

  -- Bank details (encrypted at rest via application layer)
  bank_account_name TEXT,
  bank_name TEXT,
  branch_code TEXT,
  account_number_encrypted TEXT,  -- Never store raw PAN; encrypt via pgcrypto or app layer
  account_type TEXT CHECK (account_type IN ('cheque', 'savings', 'transmission')),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_vendor_payout_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vendor_payout_preferences_updated_at
  BEFORE UPDATE ON vendor_payout_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_payout_preferences_updated_at();

COMMENT ON TABLE vendor_payout_preferences IS
  'Vendor payout preferences including bank details and payout schedule.
   Bank account number must be encrypted at rest — never stored as plaintext.';

-- ============================================================
-- PART 3: ROW LEVEL SECURITY (RLS)
-- ============================================================

-- 3a. vendor_payments RLS
ALTER TABLE vendor_payments ENABLE ROW LEVEL SECURITY;

-- Tenants can view their own payments
CREATE POLICY "vp_tenant_select" ON vendor_payments
  FOR SELECT
  USING (tenant_id = auth.uid());

-- Vendors can view their own payments
CREATE POLICY "vp_vendor_select" ON vendor_payments
  FOR SELECT
  USING (vendor_id = auth.uid());

-- Owners can view payments for their properties
CREATE POLICY "vp_owner_select" ON vendor_payments
  FOR SELECT
  USING (owner_id = auth.uid());

-- Service role (Edge Functions) can do full CRUD
CREATE POLICY "vp_service_all" ON vendor_payments
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Admins (dev_admin flag) can view all payments
CREATE POLICY "vp_admin_select" ON vendor_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND dev_admin = true
    )
  );

-- Admins can update payment/payout/dispute status (e.g., manual payout, dispute resolution)
CREATE POLICY "vp_admin_update" ON vendor_payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND dev_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND dev_admin = true
    )
  );

-- 3b. vendor_payment_ledger RLS
ALTER TABLE vendor_payment_ledger ENABLE ROW LEVEL SECURITY;

-- Service role only for ledger (vendors see aggregated earnings via API)
CREATE POLICY "vpl_service_all" ON vendor_payment_ledger
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Admins can read ledger
CREATE POLICY "vpl_admin_select" ON vendor_payment_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND dev_admin = true
    )
  );

-- 3c. vendor_payout_preferences RLS
ALTER TABLE vendor_payout_preferences ENABLE ROW LEVEL SECURITY;

-- Vendors can manage their own payout preferences
CREATE POLICY "vpp_vendor_all" ON vendor_payout_preferences
  FOR ALL
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- Service role can read/write preferences
CREATE POLICY "vpp_service_all" ON vendor_payout_preferences
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3d. closure_reports RLS for new vendor/tenant closure columns
-- NOTE: Migration 018 already provides "Tenants can update their verification"
-- policy for tenant access. We do NOT duplicate it here.
-- Instead, we add the missing vendor UPDATE policy.

-- Vendors can update closure reports for their assigned maintenance requests
-- (to set vendor_after_photos, vendor_closure_notes, vendor_confirmed_at)
DROP POLICY IF EXISTS "Vendors can update their closure reports" ON closure_reports;

CREATE POLICY "Vendors can update their closure reports"
ON closure_reports FOR UPDATE
TO authenticated
USING (
  maintenance_request_id IN (
    SELECT id FROM maintenance_requests WHERE vendor_id = auth.uid()
  )
)
WITH CHECK (
  maintenance_request_id IN (
    SELECT id FROM maintenance_requests WHERE vendor_id = auth.uid()
  )
);

-- 3e. maintenance_invoices — Add tenant SELECT policy for vendor payment flow
-- Tenants need to read invoices for their maintenance requests to pay vendors.
DROP POLICY IF EXISTS tenant_invoice_select ON maintenance_invoices;

CREATE POLICY tenant_invoice_select ON maintenance_invoices
  FOR SELECT
  USING (
    maintenance_request_id IN (
      SELECT id FROM maintenance_requests WHERE tenant_id = auth.uid()
    )
  );

COMMENT ON POLICY tenant_invoice_select ON maintenance_invoices IS
  'Tenants can view invoices for their maintenance requests (needed for vendor payment flow).';

-- ============================================================
-- PART 4: COMMENTS & DOCUMENTATION
-- ============================================================

COMMENT ON COLUMN vendor_payments.idempotency_key IS
  'Client/server-generated key to prevent duplicate payment creation.
   Used alongside gateway_transaction_id for full idempotency.';
COMMENT ON COLUMN vendor_payments.gateway_response IS
  'Raw gateway response JSON. Sanitised before exposing to clients —
   clients see only status fields via the API layer.
   Never SELECT * in client-facing queries.';
COMMENT ON COLUMN vendor_payments.net_revenue IS
  'Generated column: platform_fee - gateway_fee.
   Represents LaLarente net revenue after PayFast costs.';
COMMENT ON COLUMN vendor_payments.payout_reference IS
  'For manual_eft: bank EFT reference number.
   For payfast_payout: PayFast payout transaction ID.';
COMMENT ON COLUMN vendor_payments.dispute_status IS
  'Dispute lifecycle: none → opened (tenant claims issue) →
   resolved (admin decided) or escalated (needs higher review).
   When open, payout_method is frozen at on_hold.';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Next steps:
-- 1. Run: psql -h <host> -U <user> -d <database> -f 047_create_vendor_payment_system.sql
-- 2. Generate TypeScript types: npx supabase gen types typescript > src/types/database.types.ts
-- 3. Build the Edge Functions: createVendorPaymentCheckout + handleVendorPaymentITN
