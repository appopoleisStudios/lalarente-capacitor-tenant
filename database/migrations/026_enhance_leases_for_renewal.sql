-- Migration 026: Enhance Leases for Renewal, Termination & CPA Compliance
--
-- CPA s14(2)(c): Landlord must give notice of lease expiry
-- - 80 business days: First notice
-- - 60 business days: Second notice
-- - 40 business days: Final notice
--
-- Also adds early termination fields and auto-MTM conversion.

BEGIN;

-- ─── Lease Expiry & Renewal Tracking ────────────────────────────────────────

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS notice_80_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notice_60_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notice_40_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tenant_renewal_response TEXT
    CHECK (tenant_renewal_response IN ('renew', 'terminate', 'negotiate', 'pending')),
  ADD COLUMN IF NOT EXISTS tenant_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_converted_to_mtm BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS converted_to_mtm_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_lease_id UUID REFERENCES leases(id),
  ADD COLUMN IF NOT EXISTS renewal_count INTEGER DEFAULT 0;

-- ─── Early Termination Fields ────────────────────────────────────────────────

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS early_termination_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS early_termination_requested_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS early_termination_reason TEXT,
  ADD COLUMN IF NOT EXISTS early_termination_penalty DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS early_termination_notice_period_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS early_termination_effective_date DATE;

-- ─── Rent Escalation ────────────────────────────────────────────────────────

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS next_escalation_date DATE,
  ADD COLUMN IF NOT EXISTS last_escalation_date DATE,
  ADD COLUMN IF NOT EXISTS last_escalation_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS escalation_history JSONB DEFAULT '[]'::JSONB;

-- ─── Update Status Constraint ────────────────────────────────────────────────

ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_status_check;
ALTER TABLE leases
  ADD CONSTRAINT leases_status_check
  CHECK (status IN (
    'draft',
    'pending_signatures',
    'active',
    'month_to_month',
    'renewal_pending',
    'expired',
    'terminated',
    'early_terminated'
  ));

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_leases_end_date ON leases (end_date);
CREATE INDEX IF NOT EXISTS idx_leases_renewal_response ON leases (tenant_renewal_response);
CREATE INDEX IF NOT EXISTS idx_leases_original ON leases (original_lease_id);

-- ─── Comments ────────────────────────────────────────────────────────────────

COMMENT ON COLUMN leases.notice_80_sent_at IS 'CPA s14: Date 80-business-day notice was sent';
COMMENT ON COLUMN leases.notice_60_sent_at IS 'CPA s14: Date 60-business-day notice was sent';
COMMENT ON COLUMN leases.notice_40_sent_at IS 'CPA s14: Date 40-business-day notice was sent';
COMMENT ON COLUMN leases.tenant_renewal_response IS 'Tenant choice: renew, terminate, negotiate, or pending';
COMMENT ON COLUMN leases.auto_converted_to_mtm IS 'Whether this lease was auto-converted to month-to-month';
COMMENT ON COLUMN leases.early_termination_penalty IS 'Penalty for early termination (max 2 months rent per CPA)';

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ Leases enhanced for renewal/termination. CPA s14 notice tracking added.';
END $$;
