-- SA hardening (#240): the void-rent bypass in payments_validate_update may
-- only apply inside a trigger and only when status is the sole change.
CREATE OR REPLACE FUNCTION public.payments_void_bypass_ok(o public.payments, n public.payments)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $$
  SELECT o.status = 'pending' AND n.status = 'cancelled'
     AND n.owner_id IS NOT DISTINCT FROM o.owner_id
     AND n.tenant_id IS NOT DISTINCT FROM o.tenant_id
     AND n.lease_id IS NOT DISTINCT FROM o.lease_id
     AND n.property_id IS NOT DISTINCT FROM o.property_id
     AND n.amount IS NOT DISTINCT FROM o.amount
     AND n.due_date IS NOT DISTINCT FROM o.due_date
     AND n.type IS NOT DISTINCT FROM o.type;
$$;

CREATE OR REPLACE FUNCTION public.payments_validate_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
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
     AND pg_trigger_depth() > 1
     AND public.payments_void_bypass_ok(OLD, NEW) THEN
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


