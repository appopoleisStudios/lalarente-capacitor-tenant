-- SA review (#240): a tenant could set their own lease to 'terminated' with a
-- back-dated end, and the void-rent trigger then cancelled rent they already
-- owed (verified live). Two guards:
--
-- 1. Only the landlord (or server code) can end a lease or change its end
--    dates. Tenants request early termination; the owner accepts it.
-- 2. Voiding never touches rent that is already due: only rent due after
--    both the effective end date and today (SAST) is cancelled.

CREATE OR REPLACE FUNCTION public.guard_lease_end_by_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = OLD.owner_id THEN
    RETURN NEW;
  END IF;
  IF (NEW.status IS DISTINCT FROM OLD.status
        AND NEW.status IN ('terminated', 'early_terminated', 'expired', 'cancelled'))
     OR NEW.terminated_at IS DISTINCT FROM OLD.terminated_at
     OR NEW.end_date IS DISTINCT FROM OLD.end_date THEN
    RAISE EXCEPTION 'only the landlord can end a lease or change its end date'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_lease_end_by_owner ON public.leases;
CREATE TRIGGER trg_guard_lease_end_by_owner
  BEFORE UPDATE ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_lease_end_by_owner();

CREATE OR REPLACE FUNCTION public.void_future_rent_on_lease_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_end date;
  v_today date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     OR NEW.status NOT IN ('terminated', 'early_terminated', 'expired', 'cancelled') THEN
    RETURN NEW;
  END IF;
  -- defence in depth: only the landlord or server code ends a lease
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM NEW.owner_id THEN
    RETURN NEW;
  END IF;

  v_end := COALESCE(
    NEW.early_termination_effective_date::date,
    (NEW.terminated_at AT TIME ZONE 'Africa/Johannesburg')::date,
    CASE WHEN NEW.status = 'expired' THEN NEW.end_date::date END,
    v_today
  );

  PERFORM set_config('lalarente.void_rent', 'on', true);
  UPDATE public.payments
     SET status = 'cancelled'
   WHERE lease_id = NEW.id
     AND status = 'pending'
     AND due_date::date > GREATEST(v_end, v_today);   -- never rent already due
  PERFORM set_config('lalarente.void_rent', 'off', true);

  RETURN NEW;
END $$;
