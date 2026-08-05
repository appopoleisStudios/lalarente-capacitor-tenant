-- ============================================================
-- MIGRATION 055: Enable pg_net for auto-escalation crons (Plane #62)
-- ============================================================
-- The Plane #62 cron jobs (auto-approve-closures, payment-retry-nudges,
-- reconcile-stuck-payments, process-vendor-payouts) call edge functions via
-- `net.http_post()`, which lives in the pg_net extension.
--
-- On the live project the extension was NEVER installed, so every scheduled
-- run failed with `ERROR: schema "net" does not exist` (verified via
-- cron.job_run_details: 72/72, 289/289, 3/3 failures). This migration
-- installs it. The extension owns its own `net` schema, so do NOT pre-create
-- it (CREATE SCHEMA first makes `CREATE EXTENSION` fail with 55000).
--
-- Idempotent: `IF NOT EXISTS` is safe to re-apply.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Sanity: the function the crons rely on must now resolve.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'http_post' AND pronamespace = 'net'::regnamespace
  ) THEN
    RAISE EXCEPTION 'pg_net installed but net.http_post() not found';
  END IF;
END $$;
