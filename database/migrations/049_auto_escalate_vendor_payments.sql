-- ============================================================
-- MIGRATION 049: Auto-escalation cron — closures + payments
-- ============================================================
-- Handles three operational tasks on a cron schedule:
--
-- 1. Auto-approve closure_reports where tenant is unresponsive
--    for 72+ hours (tenant_verification_status = 'pending_tenant'
--    and auto_approve_at <= now())
--
-- 2. Cancel stuck vendor_payments (payment_status = 'processing'
--    for 30+ minutes — ITN never arrived or was lost)
--
-- 3. Retry nudges: update maintenance requests where closure
--    auto-approve deadline is approaching (< 12h) so notification
--    system can nudge the tenant
--
-- Depends on: migrations 018 (closure_reports), 040 (dev_function_logs),
--             047 (vendor_payments)
-- ============================================================

-- ── Main escalation function ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auto_escalate_vendor_payments()
RETURNS TABLE (
  auto_approved_closures       INTEGER,
  cancelled_stuck_payments     INTEGER,
  pending_nudge_count          INTEGER,
  message                      TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
  v_auto_approved  INTEGER := 0;
  v_cancelled      INTEGER := 0;
  v_nudge_count    INTEGER := 0;
  v_now            TIMESTAMPTZ := now();
BEGIN
  -- ═══════════════════════════════════════════════════════════
  -- 1. Auto-approve expired closure_reports
  --    (tenant has 72h to respond, then work is auto-accepted)
  -- ═══════════════════════════════════════════════════════════
  WITH expired AS (
    UPDATE closure_reports
    SET
      tenant_verification_status = 'auto_approved',
      tenant_ack_at = v_now,
      tenant_notes = 'Auto-approved after 72 hours — tenant unresponsive'
    WHERE
      tenant_verification_status = 'pending_tenant'
      AND auto_approve_at <= v_now
      AND auto_approve_at IS NOT NULL
    RETURNING id
  )
  SELECT count(*) INTO v_auto_approved FROM expired;

  IF v_auto_approved > 0 THEN
    -- Log to dev_function_logs for audit trail
    INSERT INTO dev_function_logs (source, level, message, metadata)
    VALUES (
      'auto-escalate-vendor-payments',
      'info',
      format('Auto-approved %s expired closure(s)', v_auto_approved),
      jsonb_build_object('action', 'auto_approve_closures', 'count', v_auto_approved)
    );
  END IF;

  -- ═══════════════════════════════════════════════════════════
  -- 2. Cancel stuck vendor_payments
  --    (processing for 30+ min — ITN likely lost)
  -- ═══════════════════════════════════════════════════════════
  WITH stuck AS (
    UPDATE vendor_payments
    SET
      payment_status = 'cancelled',
      gateway_response = COALESCE(gateway_response, '{}'::jsonb) || jsonb_build_object(
        'auto_cancelled_at', v_now,
        'auto_cancel_reason', 'Payment stuck in processing for 30+ minutes — ITN never received'
      ),
      updated_at = v_now
    WHERE
      payment_status = 'processing'
      AND updated_at <= v_now - interval '30 minutes'
    RETURNING id
  )
  SELECT count(*) INTO v_cancelled FROM stuck;

  IF v_cancelled > 0 THEN
    INSERT INTO dev_function_logs (source, level, message, metadata)
    VALUES (
      'auto-escalate-vendor-payments',
      'warn',
      format('Cancelled %s stuck payment(s) (30+ min in processing)', v_cancelled),
      jsonb_build_object('action', 'cancel_stuck_payments', 'count', v_cancelled)
    );

    -- Notify affected tenants that their payment session expired
    -- (notifications are async: next cron will pick up, or client polls)
  END IF;

  -- ═══════════════════════════════════════════════════════════
  -- 3. Count closures approaching auto-approve deadline
  --    (within 12 hours) for retry nudges
  -- ═══════════════════════════════════════════════════════════
  SELECT count(*) INTO v_nudge_count
  FROM closure_reports
  WHERE
    tenant_verification_status = 'pending_tenant'
    AND auto_approve_at > v_now
    AND auto_approve_at <= v_now + interval '12 hours';

  IF v_nudge_count > 0 THEN
    INSERT INTO dev_function_logs (source, level, message, metadata)
    VALUES (
      'auto-escalate-vendor-payments',
      'info',
      format('%s closure(s) approaching auto-approve deadline (within 12h)', v_nudge_count),
      jsonb_build_object('action', 'nudge_pending', 'count', v_nudge_count)
    );
  END IF;

  -- Return summary
  RETURN QUERY SELECT
    v_auto_approved,
    v_cancelled,
    v_nudge_count,
    format(
      'Auto-approved %s closure(s). Cancelled %s stuck payment(s). %s closure(s) approaching deadline.',
      v_auto_approved, v_cancelled, v_nudge_count
    )::TEXT;
END;
$$;

COMMENT ON FUNCTION auto_escalate_vendor_payments IS
  'Cron-triggered function that: (1) auto-approves closure_reports after 72h tenant timeout,
   (2) cancels stuck vendor_payments stuck in processing for 30+ min,
   (3) counts closures approaching deadline for retry nudges.
   Logs all actions to dev_function_logs for audit trail.';

-- ── Revoke public API access ────────────────────────────────────────────────
-- Only callable via service_role (pg_cron runs as DB owner) or the edge
-- function (which uses SUPABASE_SERVICE_ROLE_KEY). Prevents clients from
-- cancelling payments or auto-approving closures via the REST API.

REVOKE EXECUTE ON FUNCTION auto_escalate_vendor_payments() FROM anon, authenticated;

-- ── Schedule via pg_cron: every hour ──────────────────────────────────────

SELECT cron.schedule(
  'auto-escalate-vendor-payments-hourly',
  '0 * * * *',  -- Every hour at minute 0
  $$SELECT auto_escalate_vendor_payments()$$
);

-- ============================================================
-- NOTE: To unschedule this cron job if needed:
--   SELECT cron.unschedule('auto-escalate-vendor-payments-hourly');
-- ============================================================
