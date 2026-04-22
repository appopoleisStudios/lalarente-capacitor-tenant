-- Migration 024: Enhance Payments Table
--
-- Adds support for:
-- - Payment variants (partial, overpayment, split)
-- - Outstanding balance tracking
-- - Credit balance management
-- - Enhanced payment method tracking

BEGIN;

-- ─── New columns on payments ─────────────────────────────────────────────────

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_variant TEXT DEFAULT 'full'
    CHECK (payment_variant IN ('full', 'partial', 'overpayment', 'split')),
  ADD COLUMN IF NOT EXISTS amount_outstanding DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS parent_payment_id UUID REFERENCES payments(id),
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN payments.payment_variant IS 'Type of payment: full, partial, overpayment, or split';
COMMENT ON COLUMN payments.amount_outstanding IS 'Remaining amount still owed on this payment';
COMMENT ON COLUMN payments.credit_balance IS 'Excess amount paid that can be applied to future payments';
COMMENT ON COLUMN payments.amount_paid IS 'Actual amount received from tenant';
COMMENT ON COLUMN payments.original_amount IS 'Original invoiced amount before any adjustments';
COMMENT ON COLUMN payments.parent_payment_id IS 'Links split payments to the original payment';
COMMENT ON COLUMN payments.notes IS 'Internal notes about this payment';

-- Index for payment chains (split/partial tracking)
CREATE INDEX IF NOT EXISTS idx_payments_parent ON payments (parent_payment_id);

-- ─── Update payment type constraint ─────────────────────────────────────────
-- Remove 'late_fee' type (illegal), add 'interest' type

DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_type_check') THEN
    ALTER TABLE payments DROP CONSTRAINT payments_type_check;
  END IF;
END $$;

-- Re-add with updated values
ALTER TABLE payments
  ADD CONSTRAINT payments_type_check
  CHECK (type IN ('rent', 'deposit', 'application_fee', 'interest', 'utility', 'other'));

-- Migrate any existing 'late_fee' types to 'interest'
UPDATE payments SET type = 'interest' WHERE type = 'late_fee';

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ Payments table enhanced with partial/overpayment/split support.';
END $$;
