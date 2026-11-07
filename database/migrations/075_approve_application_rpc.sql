-- 075_approve_application_rpc.sql
--
-- CT7-019 — owner approve-tenancy must be gated on holding deposit paid.
-- PR #202 r2 SA findings: the JS-level check isn't a server boundary.
-- This RPC enforces the invariant atomically at the database level.
--
-- Contract:
--   approve_application(app_uuid uuid) returns the updated rental_applications row.
--   Raises an exception if:
--     - caller is not the application's owner (auth.uid() mismatch)
--     - no holding_deposits row for this application exists
--     - the latest holding_deposits row is not in paid / applied / refunded
--
-- Why RPC and not UPDATE RLS:
--   The RLS WITH CHECK would have to look across tables, compare against the
--   holding_deposits status, and still allow regular updates to other columns
--   (reviewed_at, etc.). Encoding that in RLS is clumsy. A SECURITY DEFINER
--   function that performs the full status flip atomically is cleaner, and
--   the client only has one way in.
--
-- The existing UPDATE RLS on rental_applications still gates other updates;
-- callers trying to directly flip status='approved' outside this function
-- will hit a separate guard added here (approve_via_rpc trigger).

CREATE OR REPLACE FUNCTION approve_application(app_uuid uuid)
RETURNS rental_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  updated_row rental_applications;
  deposit_status text;
BEGIN
  -- Caller must be the application's owner.
  IF NOT EXISTS (
    SELECT 1 FROM public.rental_applications
    WHERE id = app_uuid AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized to approve this application';
  END IF;

  -- Read the latest holding deposit (if any) for this application.
  SELECT status INTO deposit_status
  FROM public.holding_deposits
  WHERE application_id = app_uuid
  ORDER BY created_at DESC
  LIMIT 1;

  IF deposit_status IS NULL THEN
    RAISE EXCEPTION 'cannot approve: no holding deposit for this application';
  END IF;

  IF deposit_status NOT IN ('paid', 'applied', 'refunded') THEN
    RAISE EXCEPTION 'cannot approve: holding deposit is % — must be paid, applied, or refunded', deposit_status;
  END IF;

  -- Atomic status flip. Set reviewed_at at the same transaction.
  -- PERFORM the flag so the trigger below knows this came from the RPC.
  PERFORM set_config('app.approve_via_rpc', 'true', true);
  UPDATE public.rental_applications
  SET status = 'approved',
      reviewed_at = now(),
      approved_at = now()
  WHERE id = app_uuid
  RETURNING * INTO updated_row;
  PERFORM set_config('app.approve_via_rpc', 'false', true);

  RETURN updated_row;
END $$;

-- Block direct UPDATEs that attempt to flip status to 'approved' outside
-- this function. The RPC sets app.approve_via_rpc = 'true' before the
-- UPDATE so this trigger allows it through; everyone else is rejected.
CREATE OR REPLACE FUNCTION guard_rental_applications_approved()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM 'approved')
     AND COALESCE(current_setting('app.approve_via_rpc', true), 'false') <> 'true' THEN
    RAISE EXCEPTION 'approve rental_applications only via approve_application() RPC';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_rental_applications_approved ON rental_applications;
CREATE TRIGGER trg_guard_rental_applications_approved
  BEFORE UPDATE ON rental_applications
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION guard_rental_applications_approved();

GRANT EXECUTE ON FUNCTION approve_application(uuid) TO authenticated;
