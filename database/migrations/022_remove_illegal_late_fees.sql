-- Migration 022: Remove Illegal Late Fees, Add Legal Interest
--
-- SA Law Context:
-- - CPA s40(1): Flat late fees in consumer leases are ILLEGAL
-- - Prescribed Rate of Interest Act 55 of 1975: Interest on debts
-- - National Credit Act: Interest rate caps on consumer credit
--
-- This migration replaces the illegal late_fee_amount / late_fee_grace_days
-- columns with a legal interest_on_arrears_rate capped at 2% per annum
-- above the repo rate (common SA lease practice).

BEGIN;

-- ─── Step 1: Add legal interest column ──────────────────────────────────────

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS interest_on_arrears_rate DECIMAL(5,2) DEFAULT 2.00;

-- Cap at 2% to comply with Prescribed Rate of Interest Act
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leases_interest_rate_cap'
  ) THEN
    ALTER TABLE leases
      ADD CONSTRAINT leases_interest_rate_cap
      CHECK (interest_on_arrears_rate >= 0 AND interest_on_arrears_rate <= 2.00);
  END IF;
END $$;

COMMENT ON COLUMN leases.interest_on_arrears_rate IS 'Annual interest rate (%) on overdue rent. Capped at 2% per Prescribed Rate of Interest Act 55/1975.';

-- ─── Step 2: Drop illegal late fee columns ──────────────────────────────────

-- Remove any existing late_fee type payments that haven't been paid
-- (they were illegally generated)
UPDATE payments
  SET type = 'other', amount = 0
  WHERE type = 'late_fee' AND status = 'pending';

-- Drop the illegal columns
ALTER TABLE leases
  DROP COLUMN IF EXISTS late_fee_amount,
  DROP COLUMN IF EXISTS late_fee_grace_days;

-- Remove the comment references
COMMENT ON COLUMN leases.interest_on_arrears_rate IS 'Annual interest rate (%) charged on overdue rent per Prescribed Rate of Interest Act 55/1975. Capped at 2%.';

-- ─── Step 3: Add interest tracking to payments ─────────────────────────────

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS interest_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS days_overdue INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_calculated_at TIMESTAMPTZ;

COMMENT ON COLUMN payments.interest_amount IS 'Legal interest accrued on this overdue payment';
COMMENT ON COLUMN payments.days_overdue IS 'Number of calendar days this payment is overdue';
COMMENT ON COLUMN payments.interest_calculated_at IS 'Last time interest was calculated for this payment';

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ Illegal late fees removed. Legal interest rate column added (capped at 2%%).';
END $$;
