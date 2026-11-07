-- 075_approve_application_rpc.sql
--
-- CT7-019 — owner approve-tenancy must be gated on holding deposit paid.
--
-- r6 rewrite (PR #202): enforcement lives in the TRIGGER on
-- rental_applications, not in a caller-settable session flag. The
-- session-flag design was bypassable by any SQL caller who could
-- SET LOCAL the flag themselves (Security finding). Now the trigger:
--   1. Rejects transitions to status='approved' unless the source status
--      is one of ('submitted', 'under_review'). Already-approved stays
--      idempotent via NEW IS DISTINCT FROM OLD; other sources are rejected.
--   2. Rejects transitions to status='approved' unless the latest
--      holding_deposits row for the application is in
--      ('paid', 'applied', 'refunded').
--   3. Also rejects INSERTs with status='approved' (same deposit check).
-- The SECURITY DEFINER RPC still exists for the client UX — it takes
-- the row lock and performs the UPDATE — but is no longer the only
-- enforcement point. A direct REST UPDATE / INSERT also goes through
-- the trigger and is gated identically.

-- ============================================================
-- Trigger function: the authoritative deposit + status-transition gate.
-- Runs for both INSERT (NEW.status = 'approved') and UPDATE (transitioning
-- INTO 'approved').
-- ============================================================
CREATE OR REPLACE FUNCTION guard_rental_applications_approved()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  deposit_status text;
  source_status  text;
BEGIN
  -- Idempotency: UPDATE where status stays 'approved' is a no-op pass
  -- (lets owners re-save other fields without re-triggering the gate).
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'approved'
     AND NEW.status = 'approved' THEN
    RETURN NEW;
  END IF;

  -- Only enforce when the NEW status is 'approved'. All other transitions
  -- pass straight through (edits to other columns, rejections, etc.).
  IF NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  -- Source status restriction (PR #202 r5 Senior Dev finding): a terminal
  -- or improper source cannot become 'approved'. On INSERT the source is
  -- absent, so we require the row to start as 'submitted' or 'under_review'
  -- via the same whitelist — INSERTs with status='approved' are blocked.
  source_status := CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END;

  IF source_status IS NULL
     OR source_status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION
      'approve rental_applications: source status % is not eligible (allowed: submitted, under_review)',
      COALESCE(source_status, '(insert)');
  END IF;

  -- Deposit gate: read the latest holding_deposits row with FOR UPDATE
  -- so concurrent status changes on that row serialise behind this
  -- transaction.
  SELECT status INTO deposit_status
  FROM public.holding_deposits
  WHERE application_id = NEW.id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF deposit_status IS NULL THEN
    RAISE EXCEPTION 'cannot approve: no holding deposit for this application';
  END IF;

  IF deposit_status NOT IN ('paid', 'applied', 'refunded') THEN
    RAISE EXCEPTION
      'cannot approve: holding deposit is % — must be paid, applied, or refunded',
      deposit_status;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_rental_applications_approved ON rental_applications;

-- One trigger, two events. Fires BEFORE INSERT/UPDATE, enforces both paths.
CREATE TRIGGER trg_guard_rental_applications_approved
  BEFORE INSERT OR UPDATE ON rental_applications
  FOR EACH ROW
  EXECUTE FUNCTION guard_rental_applications_approved();

-- ============================================================
-- Client-facing RPC. Still useful for the UX — takes the row lock,
-- surfaces friendly error messages — but is no longer the ONLY
-- enforcement point. A direct REST write would hit the trigger too.
-- ============================================================
CREATE OR REPLACE FUNCTION approve_application(app_uuid uuid)
RETURNS rental_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  updated_row rental_applications;
  _app_owner  uuid;
  _app_status text;
BEGIN
  -- Reject anonymous callers explicitly (SA r4 Security P1).
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Exclusive row lock on the application. Concurrent approve calls
  -- for the same application queue behind us.
  SELECT owner_id, status INTO _app_owner, _app_status
  FROM public.rental_applications
  WHERE id = app_uuid
  FOR UPDATE;

  IF _app_owner IS NULL THEN
    RAISE EXCEPTION 'application not found';
  END IF;
  -- IS DISTINCT FROM is NULL-safe.
  IF _app_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not authorized to approve this application';
  END IF;

  -- Idempotency on the RPC level: return current row unchanged.
  -- The trigger would also accept 'approved' → 'approved' as a no-op,
  -- but we short-circuit here to avoid the UPDATE roundtrip.
  IF _app_status = 'approved' THEN
    SELECT * INTO updated_row FROM public.rental_applications WHERE id = app_uuid;
    RETURN updated_row;
  END IF;

  -- The deposit + source-status gate lives in the trigger — this UPDATE
  -- will RAISE if either fails. Keeps the RPC thin.
  UPDATE public.rental_applications
  SET status = 'approved',
      reviewed_at = now(),
      approved_at = now()
  WHERE id = app_uuid
  RETURNING * INTO updated_row;

  RETURN updated_row;
END $$;

-- Strip default PUBLIC EXECUTE; grant only to authenticated.
REVOKE EXECUTE ON FUNCTION approve_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_application(uuid) TO authenticated;
