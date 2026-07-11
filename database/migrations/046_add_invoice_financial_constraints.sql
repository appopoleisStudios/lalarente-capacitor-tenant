-- Migration: Add DB-level CHECK constraints for invoice financial fields
-- Prevents zero/negative amounts and validates VAT calculation at the database level
-- (SA review requirement — defence-in-depth beyond API-layer validation)

-- ============================================
-- Check constraints on maintenance_invoices
-- ============================================

-- 1. Subtotal must be non-negative (allow free work but not negative billing)
ALTER TABLE maintenance_invoices
  ADD CONSTRAINT check_subtotal_non_negative
  CHECK (subtotal >= 0);

-- 2. VAT amount must be non-negative
ALTER TABLE maintenance_invoices
  ADD CONSTRAINT check_vat_amount_non_negative
  CHECK (vat_amount >= 0);

-- 3. Total amount must be non-negative and >= subtotal (VAT adds, never subtracts)
ALTER TABLE maintenance_invoices
  ADD CONSTRAINT check_total_amount_valid
  CHECK (total_amount >= subtotal);

-- 4. Ensure total_amount approximately equals subtotal + vat_amount (allowing 1c rounding tolerance)
ALTER TABLE maintenance_invoices
  ADD CONSTRAINT check_total_amount_equals_subtotal_plus_vat
  CHECK (ABS(total_amount - subtotal - vat_amount) < 0.01);

-- 5. Invoice number must be non-empty
ALTER TABLE maintenance_invoices
  ADD CONSTRAINT check_invoice_number_not_empty
  CHECK (length(trim(invoice_number)) > 0);
