-- Migration 028: Holding Deposits & Viewing Cancellations
--
-- Holding deposits secure a property for a tenant during application processing.
-- RHA s5A: Holding deposit must be refunded if application is rejected.

BEGIN;

-- ─── Holding Deposits ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS holding_deposits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  application_id UUID REFERENCES rental_applications(id),

  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('eft', 'card', 'cash', 'instant_eft')),
  transaction_id TEXT,
  payment_reference TEXT,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',       -- Awaiting payment
    'paid',          -- Payment confirmed
    'applied',       -- Applied to first month's rent/deposit
    'refunded',      -- Refunded to tenant (rejected application)
    'forfeited',     -- Tenant withdrew after deadline
    'expired'        -- Not paid within deadline
  )),

  -- Deadlines
  payment_deadline TIMESTAMPTZ, -- Must pay by this date
  hold_expires_at TIMESTAMPTZ,  -- Property held until this date
  decision_deadline TIMESTAMPTZ, -- Owner must decide by this date

  -- Resolution
  paid_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  forfeited_at TIMESTAMPTZ,
  refund_reason TEXT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_holding_deposits_property ON holding_deposits (property_id);
CREATE INDEX idx_holding_deposits_tenant ON holding_deposits (tenant_id);
CREATE INDEX idx_holding_deposits_status ON holding_deposits (status);
CREATE INDEX idx_holding_deposits_application ON holding_deposits (application_id);

-- ─── Viewing Cancellations ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS viewing_cancellations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  viewing_request_id UUID NOT NULL REFERENCES viewing_requests(id) ON DELETE CASCADE,
  cancelled_by UUID NOT NULL REFERENCES profiles(id),

  reason TEXT NOT NULL CHECK (reason IN (
    'schedule_conflict',
    'property_rented',
    'tenant_found_other',
    'owner_unavailable',
    'weather',
    'emergency',
    'no_show',
    'other'
  )),
  description TEXT,
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Rescheduling
  reschedule_requested BOOLEAN DEFAULT FALSE,
  rescheduled_to TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_viewing_cancellations_request ON viewing_cancellations (viewing_request_id);
CREATE INDEX idx_viewing_cancellations_by ON viewing_cancellations (cancelled_by);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE holding_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their holding deposits"
  ON holding_deposits FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "Owners can view holding deposits on their properties"
  ON holding_deposits FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM properties WHERE properties.id = holding_deposits.property_id AND properties.owner_id = auth.uid()
  ));

CREATE POLICY "Tenants can create holding deposits"
  ON holding_deposits FOR INSERT TO authenticated
  WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Owners can update holding deposits"
  ON holding_deposits FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM properties WHERE properties.id = holding_deposits.property_id AND properties.owner_id = auth.uid()
  ));

ALTER TABLE viewing_cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cancellations they're involved in"
  ON viewing_cancellations FOR SELECT TO authenticated
  USING (cancelled_by = auth.uid() OR EXISTS (
    SELECT 1 FROM viewing_requests
    WHERE viewing_requests.id = viewing_cancellations.viewing_request_id
    AND (viewing_requests.tenant_id = auth.uid() OR viewing_requests.owner_id = auth.uid())
  ));

CREATE POLICY "Users can create cancellations"
  ON viewing_cancellations FOR INSERT TO authenticated
  WITH CHECK (cancelled_by = auth.uid());

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ Holding deposits and viewing cancellations tables created.';
END $$;
