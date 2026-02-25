-- ============================================================================
-- Migration 032: Deposit Interest Accrual Function + Monthly Cron
-- ============================================================================
-- RHA s5(3)(d): Security deposit must earn interest at the prescribed savings
-- account rate. All interest belongs to the tenant.
--
-- This creates a server-side function that:
-- 1. Calculates compound monthly interest for all active leases with deposits
-- 2. Inserts a record into deposit_interest_accruals (idempotent — safe to re-run)
-- 3. Updates leases.deposit_total_interest running total
-- 4. Schedules automatically on the 1st of each month via pg_cron
-- ============================================================================

-- ── Core accrual function ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION accrue_deposit_interest()
RETURNS TABLE (
  processed_count   INTEGER,
  skipped_count     INTEGER,
  total_interest_accrued DECIMAL(10,2),
  message           TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_processed         INTEGER := 0;
  v_skipped           INTEGER := 0;
  v_total_interest    DECIMAL(10,2) := 0;
  v_lease             RECORD;
  v_monthly_rate      DECIMAL(14,10);
  v_current_balance   DECIMAL(10,2);
  v_monthly_interest  DECIMAL(10,2);
  v_new_total         DECIMAL(10,2);
  v_period_start      DATE;
  v_period_end        DATE;
  v_already_accrued   BOOLEAN;
BEGIN
  -- Current month window
  v_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  v_period_end   := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- Process every active lease that has a deposit
  FOR v_lease IN
    SELECT id, tenant_id, deposit_amount,
           COALESCE(deposit_interest_rate, 0.0525) AS rate,
           COALESCE(deposit_total_interest, 0)     AS total_interest
    FROM   leases
    WHERE  status IN ('active', 'renewal_pending')
      AND  deposit_amount IS NOT NULL
      AND  deposit_amount > 0
  LOOP
    -- Idempotent: skip if already accrued this month
    SELECT EXISTS (
      SELECT 1 FROM deposit_interest_accruals
      WHERE  lease_id = v_lease.id
        AND  accrual_period_start = v_period_start
    ) INTO v_already_accrued;

    IF v_already_accrued THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Monthly compound interest on running balance (deposit + all prior interest)
    v_monthly_rate     := v_lease.rate / 12.0;
    v_current_balance  := v_lease.deposit_amount + v_lease.total_interest;
    v_monthly_interest := ROUND((v_current_balance * v_monthly_rate)::NUMERIC, 2);
    v_new_total        := v_lease.total_interest + v_monthly_interest;

    -- Record the accrual
    INSERT INTO deposit_interest_accruals (
      lease_id, tenant_id,
      deposit_amount, interest_rate,
      accrual_period_start, accrual_period_end,
      interest_earned, cumulative_interest, balance_after_interest
    ) VALUES (
      v_lease.id, v_lease.tenant_id,
      v_lease.deposit_amount, v_lease.rate,
      v_period_start, v_period_end,
      v_monthly_interest, v_new_total,
      v_lease.deposit_amount + v_new_total
    );

    -- Update running total on the lease
    UPDATE leases
    SET    deposit_total_interest = v_new_total
    WHERE  id = v_lease.id;

    v_processed      := v_processed + 1;
    v_total_interest := v_total_interest + v_monthly_interest;
  END LOOP;

  RETURN QUERY SELECT
    v_processed,
    v_skipped,
    v_total_interest,
    FORMAT(
      'Accrued interest for %s leases (R %s total). %s already done this month.',
      v_processed, v_total_interest, v_skipped
    )::TEXT;
END;
$$;

-- ── Schedule via pg_cron: 1st of every month at 01:00 UTC ──────────────────
-- (= 03:00 SAST — after midnight, before business opens)

SELECT cron.schedule(
  'accrue-deposit-interest-monthly',
  '0 1 1 * *',
  $$SELECT accrue_deposit_interest()$$
);
