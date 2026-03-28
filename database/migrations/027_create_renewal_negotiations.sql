-- Migration 027: Renewal Negotiations Table
--
-- Tracks the back-and-forth negotiation between landlord and tenant
-- during lease renewal. Supports offer/counter-offer flow.

BEGIN;

CREATE TABLE IF NOT EXISTS renewal_negotiations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),

  -- Negotiation flow
  round INTEGER NOT NULL DEFAULT 1,
  initiated_by UUID NOT NULL REFERENCES profiles(id),

  -- Terms being negotiated
  proposed_monthly_rent DECIMAL(10,2) NOT NULL,
  proposed_lease_type TEXT NOT NULL CHECK (proposed_lease_type IN ('fixed', 'month_to_month')),
  proposed_duration_months INTEGER, -- NULL for month-to-month
  proposed_start_date DATE NOT NULL,
  proposed_escalation_rate DECIMAL(5,2),
  proposed_terms_notes TEXT,

  -- Response
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',        -- Awaiting response
    'accepted',       -- Other party accepted
    'counter_offer',  -- Counter-offer made
    'rejected',       -- Rejected outright
    'expired',        -- No response within deadline
    'withdrawn'       -- Proposer withdrew
  )),
  response_at TIMESTAMPTZ,
  response_notes TEXT,
  response_deadline TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_renewal_neg_lease ON renewal_negotiations (lease_id);
CREATE INDEX idx_renewal_neg_status ON renewal_negotiations (status);
CREATE INDEX idx_renewal_neg_tenant ON renewal_negotiations (tenant_id);
CREATE INDEX idx_renewal_neg_owner ON renewal_negotiations (owner_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE renewal_negotiations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their renewal negotiations"
  ON renewal_negotiations FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "Owners can view their renewal negotiations"
  ON renewal_negotiations FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create renewal negotiations"
  ON renewal_negotiations FOR INSERT
  TO authenticated
  WITH CHECK (initiated_by = auth.uid());

CREATE POLICY "Involved users can update negotiations"
  ON renewal_negotiations FOR UPDATE
  TO authenticated
  USING (tenant_id = auth.uid() OR owner_id = auth.uid());

-- ─── Trigger ─────────────────────────────────────────────────────────────────

CREATE TRIGGER renewal_negotiations_updated_at
  BEFORE UPDATE ON renewal_negotiations
  FOR EACH ROW EXECUTE FUNCTION update_leases_updated_at();

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ Renewal negotiations table created.';
END $$;
