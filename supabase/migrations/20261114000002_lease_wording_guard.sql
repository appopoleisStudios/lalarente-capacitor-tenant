-- CT7-022 (SA review): the lease wording that drives the signed PDF —
-- lease_custom_clauses and lease_clause_overrides — may only be changed by
-- the lease's owner, and only before either party has signed. Lease UPDATE
-- RLS is row-level, so without this a tenant could rewrite clauses on their
-- own lease, or either party could change them after the other signed.
-- Service-role writes (auth.uid() IS NULL) are trusted server code.
CREATE OR REPLACE FUNCTION public.guard_lease_wording()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.lease_custom_clauses IS NOT DISTINCT FROM OLD.lease_custom_clauses
     AND NEW.lease_clause_overrides IS NOT DISTINCT FROM OLD.lease_clause_overrides THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'only the landlord can change the lease wording';
  END IF;

  IF OLD.tenant_signed_at IS NOT NULL OR OLD.owner_signed_at IS NOT NULL THEN
    RAISE EXCEPTION 'lease wording cannot change after signing has started';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_lease_wording ON public.leases;
CREATE TRIGGER trg_guard_lease_wording
  BEFORE UPDATE ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_lease_wording();
