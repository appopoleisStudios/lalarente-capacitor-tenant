-- ============================================================================
-- Migration 052: Schedule process-vendor-payouts via pg_cron (daily)
-- ============================================================================
-- The process-vendor-payouts edge function is already deployed and the admin
-- dashboard is fully wired (batch initiate, mark sent, grouped by vendor).
-- This migration adds a pg_cron schedule so that the function runs daily at
-- 02:00 UTC (04:00 SAST) to auto-initiate processing for all pending payouts.
--
-- The cron job invokes the function via the Supabase Management API endpoint
-- (POST /functions/v1/process-vendor-payouts) with the service-role key.
-- We use net.http_post() to call it from within the database, matching the
-- established pattern from schedule-auto-crons.mjs.
--
-- Prerequisites:
--   - supabase/functions/process-vendor-payouts already deployed
--   - SUPABASE_SERVICE_ROLE_KEY set as a database secret
-- ============================================================================

-- ── Helper: call the process-vendor-payouts edge function ──────────────────
-- Uses net.http_post() to invoke the function with the service-role key.
-- The function returns 200 on success, logs errors to the edge function logs.

CREATE OR REPLACE FUNCTION invoke_process_vendor_payouts()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key  TEXT;
  v_result       TEXT;
  v_http_status  INT;
BEGIN
  -- Read secrets (must be set in Supabase via `supabase secrets set`)
  v_supabase_url := current_setting('secrets.supabase_url', TRUE);
  v_service_key  := current_setting('secrets.service_role_key', TRUE);

  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    RETURN 'ERROR: secrets.supabase_url or secrets.service_role_key not set';
  END IF;

  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/process-vendor-payouts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('method', 'manual_eft')
  ) INTO v_http_status;

  IF v_http_status = 200 THEN
    RETURN 'OK: process-vendor-payouts invoked successfully';
  ELSE
    RETURN 'WARN: http status ' || v_http_status;
  END IF;
END;
$$;

-- ── Schedule via pg_cron: daily at 02:00 UTC (= 04:00 SAST) ────────────────
-- Runs after midnight, before business hours, processing overnight.

SELECT cron.schedule(
  'process-vendor-payouts-daily',
  '0 2 * * *',
  $$SELECT invoke_process_vendor_payouts()$$
);

-- ── Log the schedule creation ──────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✅ process-vendor-payouts cron scheduled: daily at 02:00 UTC';
END;
$$;