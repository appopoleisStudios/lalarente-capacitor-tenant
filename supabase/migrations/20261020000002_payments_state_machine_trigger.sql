-- Harden the payments RLS: enforce party-column immutability and the
-- documented state machine via BEFORE UPDATE trigger. Previous migration
-- (20261020000001) granted both parties UPDATE access with a broken
-- "neither can reassign" claim — tenant could set owner_id = anyone,
-- and either party could self-complete. This migration locks that down.
--
-- State machine enforced at the DB:
--   pending    → processing   (only by tenant)
--   processing → completed    (only by owner)
--   processing → pending      (only by owner — reversal, e.g. bounced EFT)
--   any        → failed       (only by owner)
--
-- Immutable columns on any UPDATE: owner_id, tenant_id, lease_id,
-- property_id, amount, due_date, type. These are set at creation and
-- MUST NOT change via the client UPDATE path.

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

DROP TRIGGER IF EXISTS payments_validate_update_trg ON public.payments;
CREATE TRIGGER payments_validate_update_trg
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_validate_update();

-- The RLS policy from 20261020000001 remains as the row-visibility gate
-- (which rows can be touched at all); this trigger adds the column +
-- transition rules on top.
