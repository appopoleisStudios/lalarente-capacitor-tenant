-- Migration 025: Arrears Escalation, Payment Disputes & Arrangements
--
-- Implements the legal arrears process per CPA s14:
-- 1. Friendly reminder (7 days overdue)
-- 2. Formal demand (14 days overdue)
-- 3. Breach notice with 20 business day cure period
-- 4. Legal action / eviction notice
--
-- Also creates payment disputes and payment arrangement tables.

BEGIN;

-- ─── 1. Arrears Escalations ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS arrears_escalations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  property_id UUID NOT NULL REFERENCES properties(id),

  -- Escalation stage
  stage TEXT NOT NULL CHECK (stage IN (
    'friendly_reminder',   -- Day 7: SMS/push reminder
    'formal_demand',       -- Day 14: Written demand letter
    'breach_notice',       -- Day 21: CPA s14 breach notice
    'cure_period',         -- 20 business days to cure
    'legal_action',        -- Post cure: Referred to attorney
    'eviction_notice',     -- Final: PIE Act notice
    'resolved'             -- Paid / arrangement reached
  )),

  -- Tracking
  amount_owed DECIMAL(10,2) NOT NULL,
  interest_accrued DECIMAL(10,2) DEFAULT 0,
  total_owed DECIMAL(10,2) NOT NULL, -- amount_owed + interest_accrued

  -- Dates
  escalated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cure_period_starts_at TIMESTAMPTZ,
  cure_period_ends_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  -- Communication
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,
  notification_method TEXT CHECK (notification_method IN ('push', 'sms', 'email', 'letter')),

  -- Documents
  breach_notice_url TEXT,
  demand_letter_url TEXT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_arrears_payment ON arrears_escalations (payment_id);
CREATE INDEX idx_arrears_tenant ON arrears_escalations (tenant_id);
CREATE INDEX idx_arrears_owner ON arrears_escalations (owner_id);
CREATE INDEX idx_arrears_stage ON arrears_escalations (stage);
CREATE INDEX idx_arrears_lease ON arrears_escalations (lease_id);

-- ─── 2. Payment Disputes ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  raised_by UUID NOT NULL REFERENCES profiles(id), -- tenant or owner
  lease_id UUID NOT NULL REFERENCES leases(id),

  -- Dispute details
  reason TEXT NOT NULL CHECK (reason IN (
    'incorrect_amount',     -- Amount charged is wrong
    'already_paid',         -- Payment was already made
    'unauthorized_charge',  -- Charge was not agreed upon
    'service_issue',        -- Maintenance not completed
    'calculation_error',    -- Interest/amount miscalculated
    'other'
  )),
  description TEXT NOT NULL,
  disputed_amount DECIMAL(10,2) NOT NULL,

  -- Evidence
  evidence_urls TEXT[], -- Array of document/screenshot URLs

  -- Resolution
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',           -- Newly raised
    'under_review',   -- Being investigated
    'mediation',      -- Both parties in discussion
    'resolved',       -- Settled
    'rejected',       -- Dispute rejected
    'escalated'       -- Sent to external mediation
  )),
  resolution_notes TEXT,
  resolution_amount DECIMAL(10,2), -- Adjusted amount if applicable
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disputes_payment ON payment_disputes (payment_id);
CREATE INDEX idx_disputes_raised_by ON payment_disputes (raised_by);
CREATE INDEX idx_disputes_status ON payment_disputes (status);
CREATE INDEX idx_disputes_lease ON payment_disputes (lease_id);

-- ─── 3. Payment Arrangements ────────────────────────────────────────────────
-- When tenant can't pay full amount, owner can agree to an instalment plan.

CREATE TABLE IF NOT EXISTS payment_arrangements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),

  -- Arrangement details
  total_owed DECIMAL(10,2) NOT NULL,
  monthly_instalment DECIMAL(10,2) NOT NULL,
  number_of_instalments INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN (
    'proposed',     -- Tenant or owner proposed
    'accepted',     -- Both parties agreed
    'active',       -- Payments being made
    'completed',    -- All instalments paid
    'defaulted',    -- Tenant missed instalment
    'cancelled'     -- Arrangement cancelled
  )),

  -- Tracking
  amount_paid DECIMAL(10,2) DEFAULT 0,
  instalments_paid INTEGER DEFAULT 0,
  next_due_date DATE,

  -- Approval
  proposed_by UUID NOT NULL REFERENCES profiles(id),
  accepted_by UUID REFERENCES profiles(id),
  accepted_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_arrangements_lease ON payment_arrangements (lease_id);
CREATE INDEX idx_arrangements_tenant ON payment_arrangements (tenant_id);
CREATE INDEX idx_arrangements_status ON payment_arrangements (status);

-- ─── RLS Policies ───────────────────────────────────────────────────────────

-- Arrears Escalations
ALTER TABLE arrears_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their arrears"
  ON arrears_escalations FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "Owners can view their property arrears"
  ON arrears_escalations FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can create arrears escalations"
  ON arrears_escalations FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update arrears escalations"
  ON arrears_escalations FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- Payment Disputes
ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view disputes they're involved in"
  ON payment_disputes FOR SELECT
  TO authenticated
  USING (
    raised_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM leases
      WHERE leases.id = payment_disputes.lease_id
      AND (leases.tenant_id = auth.uid() OR leases.owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can create disputes"
  ON payment_disputes FOR INSERT
  TO authenticated
  WITH CHECK (raised_by = auth.uid());

CREATE POLICY "Involved users can update disputes"
  ON payment_disputes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leases
      WHERE leases.id = payment_disputes.lease_id
      AND (leases.tenant_id = auth.uid() OR leases.owner_id = auth.uid())
    )
  );

-- Payment Arrangements
ALTER TABLE payment_arrangements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their arrangements"
  ON payment_arrangements FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "Owners can view their arrangements"
  ON payment_arrangements FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create arrangements"
  ON payment_arrangements FOR INSERT
  TO authenticated
  WITH CHECK (proposed_by = auth.uid());

CREATE POLICY "Involved users can update arrangements"
  ON payment_arrangements FOR UPDATE
  TO authenticated
  USING (tenant_id = auth.uid() OR owner_id = auth.uid());

-- ─── Triggers ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_arrears_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER arrears_escalations_updated_at
  BEFORE UPDATE ON arrears_escalations
  FOR EACH ROW EXECUTE FUNCTION update_arrears_updated_at();

CREATE TRIGGER payment_disputes_updated_at
  BEFORE UPDATE ON payment_disputes
  FOR EACH ROW EXECUTE FUNCTION update_arrears_updated_at();

CREATE TRIGGER payment_arrangements_updated_at
  BEFORE UPDATE ON payment_arrangements
  FOR EACH ROW EXECUTE FUNCTION update_arrears_updated_at();

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ Arrears escalation, payment disputes, and payment arrangements tables created.';
END $$;
