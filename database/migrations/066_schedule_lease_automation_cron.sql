-- Migration 066: Schedule lease automation cron (Plane #102)
-- Runs daily at 06:00 UTC (08:00 SAST)
-- Handles: MTM auto-conversion, rent escalations, expiry warnings
--
-- Prerequisites (apply once per project):
--   SELECT vault.create_secret('<project-url>', 'SUPABASE_URL', '…');
--   SELECT vault.create_secret('<service-role-jwt>', 'SUPABASE_SERVICE_ROLE_KEY', '…');
--
-- Supabase exposes secrets via vault.decrypted_secrets (there is no
-- vault.decrypt_secret() helper on this stack). Never bake the JWT into
-- cron.job.command — read it from vault at execution time.

DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname IN ('vault', 'supabase_vault'))
     AND EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'SUPABASE_URL')
     AND EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
  THEN
    BEGIN
      PERFORM cron.unschedule('process-lease-automation');
    EXCEPTION
      WHEN OTHERS THEN
        NULL; -- job may not exist yet
    END;

    PERFORM cron.schedule(
      'process-lease-automation',
      '0 6 * * *',
      $query$SELECT net.http_post(
          url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL')
                 || '/functions/v1/process-lease-automation',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
          ),
          body := '{"trigger": "cron"}'::jsonb
        );$query$
    );
    RAISE NOTICE '✅ process-lease-automation cron scheduled (daily 06:00 UTC, vault-backed)';
  ELSE
    RAISE WARNING '❌ vault secrets SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — '
                   'process-lease-automation cron NOT scheduled. '
                   'Create them with vault.create_secret then re-run this migration.';
  END IF;
END $block$;
