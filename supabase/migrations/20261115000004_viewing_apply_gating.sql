-- CT7-030: one open (pending/approved) viewing request per tenant per property.
CREATE UNIQUE INDEX IF NOT EXISTS uq_viewing_requests_open_per_tenant_property
  ON public.viewing_requests (tenant_id, property_id)
  WHERE status IN ('pending', 'approved');

-- CT7-032: no application while the tenant's viewing of that property is still
-- ahead (confirmed time not yet reached, or — unconfirmed — the requested day
-- not yet over in SAST). Completed / cancelled / declined viewings don't block.
CREATE OR REPLACE FUNCTION public.guard_apply_after_viewing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.viewing_requests v
    WHERE v.tenant_id = NEW.tenant_id
      AND v.property_id = NEW.property_id
      AND v.status IN ('pending', 'approved')
      AND COALESCE(
            v.confirmed_date,
            ((v.requested_date + 1)::timestamp AT TIME ZONE 'Africa/Johannesburg')
          ) > now()
  ) THEN
    RAISE EXCEPTION 'You can apply once your scheduled viewing of this property has taken place'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_apply_after_viewing ON public.rental_applications;
CREATE TRIGGER trg_guard_apply_after_viewing
  BEFORE INSERT ON public.rental_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_apply_after_viewing();
