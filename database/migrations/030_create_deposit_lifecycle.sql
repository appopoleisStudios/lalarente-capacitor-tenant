-- Migration 030: Deposit Lifecycle Tables
--
-- RHA s5(3): Security deposit must be held in interest-bearing account.
-- RHA s5(7): Deposit + interest must be returned within 7-14 days of lease end.
-- Interest must be calculated at the prescribed rate.

BEGIN;

-- ─── 1. Deposit Interest Accruals ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deposit_interest_accruals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),

  deposit_amount DECIMAL(10,2) NOT NULL,
  interest_rate DECIMAL(5,4) NOT NULL, -- Annual rate (e.g. 0.0525 for 5.25%)
  accrual_period_start DATE NOT NULL,
  accrual_period_end DATE NOT NULL,
  interest_earned DECIMAL(10,2) NOT NULL,
  cumulative_interest DECIMAL(10,2) NOT NULL,
  balance_after_interest DECIMAL(10,2) NOT NULL,

  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deposit_interest_lease ON deposit_interest_accruals (lease_id);
CREATE INDEX idx_deposit_interest_tenant ON deposit_interest_accruals (tenant_id);
CREATE INDEX idx_deposit_interest_period ON deposit_interest_accruals (accrual_period_start, accrual_period_end);

-- ─── 2. Deposit Deductions ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deposit_deductions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  tenant_id UUID NOT NULL REFERENCES profiles(id),

  deduction_type TEXT NOT NULL CHECK (deduction_type IN (
    'damage_repair',
    'cleaning',
    'unpaid_rent',
    'unpaid_utilities',
    'key_replacement',
    'other'
  )),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  evidence_urls TEXT[],

  -- Tenant response
  tenant_agreed BOOLEAN,
  tenant_response_at TIMESTAMPTZ,
  tenant_dispute_reason TEXT,

  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN (
    'proposed',    -- Owner proposed deduction
    'agreed',      -- Tenant agreed
    'disputed',    -- Tenant disputes
    'mediated',    -- Sent to mediation
    'finalized'    -- Final (applied or dropped)
  )),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deposit_deductions_lease ON deposit_deductions (lease_id);
CREATE INDEX idx_deposit_deductions_status ON deposit_deductions (status);

-- ─── 3. Deposit Disputes ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deposit_disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),

  dispute_type TEXT NOT NULL CHECK (dispute_type IN (
    'full_refund',              -- Tenant wants full refund
    'partial_deduction',        -- Disputes specific deductions
    'interest_calculation',     -- Disputes interest amount
    'delayed_refund',           -- Refund not received in time
    'unfair_deduction'          -- Deduction is unreasonable
  )),
  description TEXT NOT NULL,
  disputed_amount DECIMAL(10,2) NOT NULL,

  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'under_review', 'mediation', 'resolved', 'escalated_rth'
  )),

  -- Resolution
  resolution_notes TEXT,
  resolved_amount DECIMAL(10,2),
  resolved_at TIMESTAMPTZ,

  -- Rental Housing Tribunal escalation
  rth_case_number TEXT,
  escalated_to_rth_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deposit_disputes_lease ON deposit_disputes (lease_id);
CREATE INDEX idx_deposit_disputes_status ON deposit_disputes (status);

-- ─── Enhance leases with deposit tracking ───────────────────────────────────

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS deposit_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS deposit_account_number TEXT,
  ADD COLUMN IF NOT EXISTS deposit_interest_rate DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS deposit_total_interest DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_refund_status TEXT
    CHECK (deposit_refund_status IN ('not_applicable', 'pending_inspection', 'deductions_proposed', 'disputed', 'refunded')),
  ADD COLUMN IF NOT EXISTS deposit_refund_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS deposit_refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_refund_deadline DATE;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE deposit_interest_accruals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their deposit interest"
  ON deposit_interest_accruals FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "Owners can view deposit interest for their leases"
  ON deposit_interest_accruals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM leases WHERE leases.id = deposit_interest_accruals.lease_id AND leases.owner_id = auth.uid()));

ALTER TABLE deposit_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their deductions"
  ON deposit_deductions FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "Owners can manage deductions"
  ON deposit_deductions FOR ALL TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Tenants can update their deduction response"
  ON deposit_deductions FOR UPDATE TO authenticated
  USING (tenant_id = auth.uid());

ALTER TABLE deposit_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Involved parties can view deposit disputes"
  ON deposit_disputes FOR SELECT TO authenticated
  USING (tenant_id = auth.uid() OR owner_id = auth.uid());

CREATE POLICY "Either party can create deposit disputes"
  ON deposit_disputes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = auth.uid() OR owner_id = auth.uid());

CREATE POLICY "Either party can update deposit disputes"
  ON deposit_disputes FOR UPDATE TO authenticated
  USING (tenant_id = auth.uid() OR owner_id = auth.uid());

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ Deposit lifecycle tables created. RHA interest compliance enabled.';
END $$;
