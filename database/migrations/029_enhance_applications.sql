-- Migration 029: Enhance Applications & Property State Machine
--
-- Adds application competition (backup applicants) and
-- property status state machine.

BEGIN;

-- ─── Enhance Rental Applications ────────────────────────────────────────────

ALTER TABLE rental_applications
  ADD COLUMN IF NOT EXISTS backup_rank INTEGER,
  ADD COLUMN IF NOT EXISTS score DECIMAL(5,2), -- Credit/suitability score
  ADD COLUMN IF NOT EXISTS credit_check_status TEXT
    CHECK (credit_check_status IN ('pending', 'passed', 'failed', 'not_required')),
  ADD COLUMN IF NOT EXISTS credit_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS affordability_ratio DECIMAL(5,2), -- rent/income ratio
  ADD COLUMN IF NOT EXISTS holding_deposit_id UUID REFERENCES holding_deposits(id),
  ADD COLUMN IF NOT EXISTS shortlisted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shortlisted_at TIMESTAMPTZ;

COMMENT ON COLUMN rental_applications.backup_rank IS 'Rank in backup queue (1 = first backup, NULL = not backup)';
COMMENT ON COLUMN rental_applications.score IS 'Composite suitability score (0-100)';
COMMENT ON COLUMN rental_applications.affordability_ratio IS 'Rent as percentage of monthly income';

CREATE INDEX IF NOT EXISTS idx_applications_backup ON rental_applications (property_id, backup_rank)
  WHERE backup_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_shortlisted ON rental_applications (property_id, shortlisted)
  WHERE shortlisted = TRUE;

-- ─── Update Application Status Constraint ────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rental_applications_status_check') THEN
    ALTER TABLE rental_applications DROP CONSTRAINT rental_applications_status_check;
  END IF;
END $$;

ALTER TABLE rental_applications
  ADD CONSTRAINT rental_applications_status_check
  CHECK (status IN (
    'draft',
    'submitted',
    'under_review',
    'shortlisted',
    'approved',
    'rejected',
    'withdrawn',
    'backup',
    'lease_offered',
    'lease_signed'
  ));

-- ─── Enhance Properties Status ──────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_status_check') THEN
    ALTER TABLE properties DROP CONSTRAINT properties_status_check;
  END IF;
END $$;

ALTER TABLE properties
  ADD CONSTRAINT properties_status_check
  CHECK (status IN (
    'draft',
    'available',
    'viewing_active',    -- Has active viewing requests
    'applications_open', -- Accepting applications
    'holding_deposit',   -- Deposit placed, pending decision
    'lease_pending',     -- Lease being prepared
    'rented',
    'maintenance',       -- Under major maintenance
    'delisted'
  ));

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ Applications enhanced with competition features. Property state machine updated.';
END $$;
