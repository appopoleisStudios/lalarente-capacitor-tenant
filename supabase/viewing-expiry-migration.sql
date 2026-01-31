-- ============================================================================
-- VIEWING REQUEST EXPIRY MIGRATION
-- ============================================================================
-- This migration adds expiry tracking to viewing_requests table and
-- creates a function to automatically expire old requests
--
-- Author: LaLarente Team
-- Date: 2026-01-31
-- ============================================================================

-- Add expiry tracking columns to viewing_requests table
ALTER TABLE viewing_requests
ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expiry_reason TEXT;

COMMENT ON COLUMN viewing_requests.expired_at IS 'Timestamp when the viewing request was automatically expired';
COMMENT ON COLUMN viewing_requests.expiry_reason IS 'Reason for expiry: viewing_date_passed, viewing_date_passed_no_response, response_deadline_missed, or marked_as_expired';

-- Add 'expired' to viewing_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'expired'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'viewing_status')
    ) THEN
        ALTER TYPE viewing_status ADD VALUE 'expired';
    END IF;
END $$;

-- ============================================================================
-- FUNCTION: auto_expire_viewing_requests
-- ============================================================================
-- Automatically expires viewing requests that meet expiry criteria:
-- 1. Pending requests where viewing date/time has passed
-- 2. Pending requests where response deadline (24h before viewing) has passed
-- 3. Approved requests where viewing date/time has passed → mark as completed
--
-- This function should be called periodically (e.g., every hour via cron)
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_expire_viewing_requests()
RETURNS TABLE (
    expired_count INTEGER,
    completed_count INTEGER,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expired_count INTEGER := 0;
    v_completed_count INTEGER := 0;
    v_now TIMESTAMP WITH TIME ZONE := NOW();
    v_record RECORD;
BEGIN
    -- ========================================================================
    -- STEP 1: Expire pending requests where viewing date/time has passed
    -- ========================================================================
    FOR v_record IN
        SELECT id, requested_date, requested_time, tenant_id, property_id
        FROM viewing_requests
        WHERE status = 'pending'
        AND (requested_date + requested_time::TIME) < v_now
        AND expired_at IS NULL
    LOOP
        UPDATE viewing_requests
        SET
            status = 'expired',
            expired_at = v_now,
            expiry_reason = 'viewing_date_passed_no_response',
            updated_at = v_now
        WHERE id = v_record.id;

        v_expired_count := v_expired_count + 1;

        -- Log for debugging
        RAISE NOTICE 'Expired viewing request % - viewing date passed without response', v_record.id;
    END LOOP;

    -- ========================================================================
    -- STEP 2: Expire pending requests where 24h response deadline has passed
    -- ========================================================================
    FOR v_record IN
        SELECT id, requested_date, requested_time, tenant_id, property_id
        FROM viewing_requests
        WHERE status = 'pending'
        AND (requested_date + requested_time::TIME) >= v_now  -- Viewing is in future
        AND (requested_date + requested_time::TIME) < (v_now + INTERVAL '24 hours')  -- But less than 24h away
        AND expired_at IS NULL
    LOOP
        UPDATE viewing_requests
        SET
            status = 'expired',
            expired_at = v_now,
            expiry_reason = 'response_deadline_missed',
            updated_at = v_now
        WHERE id = v_record.id;

        v_expired_count := v_expired_count + 1;

        -- Log for debugging
        RAISE NOTICE 'Expired viewing request % - 24h response deadline missed', v_record.id;
    END LOOP;

    -- ========================================================================
    -- STEP 3: Auto-complete approved viewings where date/time has passed
    -- ========================================================================
    FOR v_record IN
        SELECT id, confirmed_date, requested_time, tenant_id, property_id
        FROM viewing_requests
        WHERE status = 'approved'
        AND (
            (confirmed_date IS NOT NULL AND (confirmed_date + requested_time::TIME) < v_now)
            OR
            (confirmed_date IS NULL AND (requested_date + requested_time::TIME) < v_now)
        )
        AND completed_at IS NULL
    LOOP
        UPDATE viewing_requests
        SET
            status = 'completed',
            completed_at = v_now,
            updated_at = v_now
        WHERE id = v_record.id;

        v_completed_count := v_completed_count + 1;

        -- Log for debugging
        RAISE NOTICE 'Auto-completed viewing request % - viewing date passed', v_record.id;
    END LOOP;

    -- Return summary
    RETURN QUERY SELECT
        v_expired_count,
        v_completed_count,
        FORMAT('Expired %s requests, completed %s viewings', v_expired_count, v_completed_count);
END;
$$;

COMMENT ON FUNCTION auto_expire_viewing_requests IS 'Automatically expires viewing requests and completes past viewings. Run via cron every hour.';

-- ============================================================================
-- MANUAL EXECUTION EXAMPLE
-- ============================================================================
-- To manually run the expiry function:
-- SELECT * FROM auto_expire_viewing_requests();
--
-- Expected output:
-- expired_count | completed_count | message
-- --------------+-----------------+----------------------------------------
--             5 |               2 | Expired 5 requests, completed 2 viewings

-- ============================================================================
-- CRON JOB SETUP (via Supabase Dashboard or CLI)
-- ============================================================================
-- The following cron job should be set up in Supabase to run this function hourly:
--
-- Schedule: 0 * * * * (every hour at minute 0)
-- SQL: SELECT auto_expire_viewing_requests();
--
-- To set up via Supabase Dashboard:
-- 1. Go to Database → Cron Jobs
-- 2. Create new job:
--    - Name: Auto-expire viewing requests
--    - Schedule: 0 * * * *
--    - Command: SELECT auto_expire_viewing_requests();

-- ============================================================================
-- INDEX OPTIMIZATION
-- ============================================================================
-- Add composite index for faster expiry lookups
CREATE INDEX IF NOT EXISTS idx_viewing_requests_expiry_lookup
ON viewing_requests(status, requested_date, requested_time)
WHERE status IN ('pending', 'approved') AND expired_at IS NULL;

COMMENT ON INDEX idx_viewing_requests_expiry_lookup IS 'Optimizes auto-expiry function performance';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
-- Allow the function to be called by the service role
GRANT EXECUTE ON FUNCTION auto_expire_viewing_requests() TO service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
