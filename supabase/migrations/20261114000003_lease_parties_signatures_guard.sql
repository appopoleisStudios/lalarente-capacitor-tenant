-- SA follow-up to 20261114000002: the wording guard trusts owner_id and the
-- signature timestamps, but lease UPDATE RLS is row-level, so a party could
-- rewrite those to sidestep it (e.g. set owner_id to themselves, or clear a
-- signature, edit, then restore). For any signed-in caller:
--   * the parties and property of a lease never change;
--   * a signature, once given, can't be cleared or altered;
--   * only the tenant signs as tenant, only the owner signs as owner.
-- Service-role writes (auth.uid() IS NULL) are trusted server code.
CREATE OR REPLACE FUNCTION public.guard_lease_parties_and_signatures()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.property_id IS DISTINCT FROM OLD.property_id THEN
    RAISE EXCEPTION 'the parties and property of a lease cannot be changed';
  END IF;

  IF (OLD.tenant_signed_at IS NOT NULL AND NEW.tenant_signed_at IS DISTINCT FROM OLD.tenant_signed_at)
     OR (OLD.owner_signed_at IS NOT NULL AND NEW.owner_signed_at IS DISTINCT FROM OLD.owner_signed_at)
     OR (OLD.tenant_signature_url IS NOT NULL AND NEW.tenant_signature_url IS DISTINCT FROM OLD.tenant_signature_url)
     OR (OLD.owner_signature_url IS NOT NULL AND NEW.owner_signature_url IS DISTINCT FROM OLD.owner_signature_url) THEN
    RAISE EXCEPTION 'a lease signature cannot be changed once given';
  END IF;

  IF (NEW.tenant_signed_at IS DISTINCT FROM OLD.tenant_signed_at
      OR NEW.tenant_signature_url IS DISTINCT FROM OLD.tenant_signature_url)
     AND auth.uid() IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'only the tenant can sign as tenant';
  END IF;

  IF (NEW.owner_signed_at IS DISTINCT FROM OLD.owner_signed_at
      OR NEW.owner_signature_url IS DISTINCT FROM OLD.owner_signature_url)
     AND auth.uid() IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'only the landlord can sign as landlord';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_lease_parties_and_signatures ON public.leases;
CREATE TRIGGER trg_guard_lease_parties_and_signatures
  BEFORE UPDATE ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_lease_parties_and_signatures();
