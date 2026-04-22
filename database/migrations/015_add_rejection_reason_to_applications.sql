-- Migration: Add rejection_reason field to rental_applications
-- This allows owners to provide feedback when rejecting applications

BEGIN;

-- Add rejection_reason column
ALTER TABLE rental_applications
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add comment
COMMENT ON COLUMN rental_applications.rejection_reason IS 'Reason provided by owner when rejecting the application';

COMMIT;

RAISE NOTICE '✅ Added rejection_reason column to rental_applications table';
