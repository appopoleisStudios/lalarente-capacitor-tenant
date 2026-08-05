-- ============================================================================
-- Migration 052: Schedule process-vendor-payouts via pg_cron (daily)
-- ============================================================================
-- Establishes the pg_cron schedule for the process-vendor-payouts edge function.
-- The cron job runs daily at 02:00 UTC (= 04:00 SAST), after midnight, before
-- business hours, to auto-initiate processing for all pending payouts.
--
-- The actual cron job is created by running:
--   node scripts/schedule-process-vendor-payouts.mjs
--
-- Which follows the established pattern from schedule-auto-crons.mjs:
-- fetches the service_role key at runtime via Management API, bakes it into
-- the cron SQL, and creates the schedule via net.http_post inside the cron.
--
-- The edge function accepts both:
-- - Admin JWT (from admin dashboard — users with role='admin')
-- - Service-role key (from cron trigger — decoded JWT role='service_role')
--
-- Prerequisites:
--   - supabase/functions/process-vendor-payouts deployed (with service-role auth)
--   - SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID in .env (for the script)
-- ============================================================================

-- This migration is a documentation placeholder. The actual cron.schedule()
-- call is executed by the script, which bakes the service-role key into the
-- SQL command at runtime (never persisted to disk).
--
-- Run: node scripts/schedule-process-vendor-payouts.mjs
-- Schedule: 0 2 * * * (daily at 02:00 UTC)
-- Job name: process-vendor-payouts-daily

DO $$
BEGIN
  RAISE NOTICE 'Migration 052: Run node scripts/schedule-process-vendor-payouts.mjs to create the cron schedule';
END;
$$;