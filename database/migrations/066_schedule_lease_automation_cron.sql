-- Migration 066: Schedule lease automation cron (Plane #102)
-- Runs daily at 06:00 UTC (08:00 SAST)
-- Handles: MTM auto-conversion, rent escalations, expiry warnings
--
-- cron.schedule runs inside the database. To call an edge function
-- we need the project URL and a service-role key. Both are stored as
-- Supabase secrets. vault.decrypt_secret reads them at cron execution
-- time so they never appear in plain text in pg_cron.

DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vault') THEN
    PERFORM cron.schedule(
      'process-lease-automation',
      '0 6 * * *',
      $query$SELECT net.http_post(
          url    := vault.decrypt_secret('SUPABASE_URL') || '/functions/v1/process-lease-automation',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || vault.decrypt_secret('SUPABASE_SERVICE_ROLE_KEY')
          ),
          body := '{"trigger": "cron"}'::jsonb
        );$query$
    );
    RAISE NOTICE '✅ process-lease-automation cron scheduled (daily 06:00 UTC)';
  ELSE
    -- CRITICAL: vault not available. The cron cannot be created.
    -- Developer must either enable vault or set up the cron manually.
    RAISE WARNING '❌ vault extension NOT available — process-lease-automation cron NOT scheduled. '
                   'Plane #102 will not run automatically. '
                   'Fix: enable vault extension (CREATE EXTENSION IF NOT EXISTS vault) '
                   'and set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY secrets.';
  END IF;
END $block$;
