-- CT7-029: when a lease ends, its future rent stops being "due".
-- Rent due on or before the effective end date stays owed; only PENDING rent
-- due after it is voided (status 'cancelled'). Applies to every path that
-- ends a lease (owner terminate, early termination, renewal expiry, automation).

CREATE OR REPLACE FUNCTION public.payments_validate_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Service-role bypass: migrations, admin tools, edge functions.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- CT7-029: future rent of an ended lease is voided by the lease trigger
  -- below. Only that trigger sets this transaction-local flag (it can't be
  -- set through the API), and it only ever moves pending → cancelled.
  IF current_setting('lalarente.void_rent', true) = 'on'
     AND OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Caller must be party to the row (RLS already enforces this, but
  -- defence-in-depth in case policy is relaxed).
  IF v_uid NOT IN (OLD.owner_id, OLD.tenant_id) THEN
    RAISE EXCEPTION 'payments: caller is not a party to this payment'
      USING ERRCODE = '42501';
  END IF;

  -- Immutable identity + financial columns
  IF NEW.owner_id    IS DISTINCT FROM OLD.owner_id    THEN RAISE EXCEPTION 'payments.owner_id is immutable'    USING ERRCODE = '42501'; END IF;
  IF NEW.tenant_id   IS DISTINCT FROM OLD.tenant_id   THEN RAISE EXCEPTION 'payments.tenant_id is immutable'   USING ERRCODE = '42501'; END IF;
  IF NEW.lease_id    IS DISTINCT FROM OLD.lease_id    THEN RAISE EXCEPTION 'payments.lease_id is immutable'    USING ERRCODE = '42501'; END IF;
  IF NEW.property_id IS DISTINCT FROM OLD.property_id THEN RAISE EXCEPTION 'payments.property_id is immutable' USING ERRCODE = '42501'; END IF;
  IF NEW.amount      IS DISTINCT FROM OLD.amount      THEN RAISE EXCEPTION 'payments.amount is immutable'      USING ERRCODE = '42501'; END IF;
  IF NEW.due_date    IS DISTINCT FROM OLD.due_date    THEN RAISE EXCEPTION 'payments.due_date is immutable'    USING ERRCODE = '42501'; END IF;
  IF NEW.type        IS DISTINCT FROM OLD.type        THEN RAISE EXCEPTION 'payments.type is immutable'        USING ERRCODE = '42501'; END IF;

  -- State machine
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Tenant transitions
    IF v_uid = OLD.tenant_id THEN
      IF NOT (OLD.status = 'pending' AND NEW.status = 'processing') THEN
        RAISE EXCEPTION 'payments: tenant may only move pending → processing (attempted % → %)', OLD.status, NEW.status
          USING ERRCODE = '42501';
      END IF;
    -- Owner transitions
    ELSIF v_uid = OLD.owner_id THEN
      IF NOT (
        (OLD.status = 'processing' AND NEW.status IN ('completed', 'pending', 'failed')) OR
        (OLD.status IN ('pending', 'overdue') AND NEW.status = 'failed')
      ) THEN
        RAISE EXCEPTION 'payments: owner may not transition % → %', OLD.status, NEW.status
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.void_future_rent_on_lease_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_end date;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     OR NEW.status NOT IN ('terminated', 'early_terminated', 'expired', 'cancelled') THEN
    RETURN NEW;
  END IF;

  v_end := COALESCE(
    NEW.early_termination_effective_date::date,
    (NEW.terminated_at AT TIME ZONE 'Africa/Johannesburg')::date,
    CASE WHEN NEW.status = 'expired' THEN NEW.end_date::date END,
    (now() AT TIME ZONE 'Africa/Johannesburg')::date
  );

  PERFORM set_config('lalarente.void_rent', 'on', true);
  UPDATE public.payments
     SET status = 'cancelled'
   WHERE lease_id = NEW.id
     AND status = 'pending'
     AND due_date::date > v_end;
  PERFORM set_config('lalarente.void_rent', 'off', true);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_void_future_rent_on_lease_end ON public.leases;
CREATE TRIGGER trg_void_future_rent_on_lease_end
  AFTER UPDATE OF status ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION public.void_future_rent_on_lease_end();
