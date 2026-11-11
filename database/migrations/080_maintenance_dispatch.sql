-- CT7-023: Dispatch authority — RLS policies and dispatch RPCs
-- Depends on: 079_maintenance_responsibility.sql
-- Sections: §6 PSI RLS, §6b PSI lock, §7 capture_dispatch_authority,
--           §8 release_to_tenant_dispatch, §9 reclaim_request,
--           §10-§11 maintenance_requests RLS policies

-- ─── 6. RLS policies: property_service_items ──────────────────────────────────

DROP POLICY IF EXISTS psi_owner_rw      ON property_service_items;
DROP POLICY IF EXISTS psi_tenant_select ON property_service_items;

CREATE POLICY psi_owner_rw ON property_service_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_service_items.property_id
      AND p.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_service_items.property_id
      AND p.owner_id = auth.uid()
  ));

CREATE POLICY psi_tenant_select ON property_service_items
  FOR SELECT TO authenticated
  USING (
    property_service_items.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM leases l
      WHERE l.property_id = property_service_items.property_id
        AND l.tenant_id   = auth.uid()
        AND l.status      = 'active'
    )
  );

-- ─── 6b. property_service_items — immutable property membership ───────────────
-- Once a service item is referenced by a maintenance request, its property_id
-- must not change. Moving it to another property (even one owned by the same user)
-- would leave the maintenance request pointing to an item on the wrong property.

CREATE OR REPLACE FUNCTION lock_psi_property_id()
RETURNS trigger LANGUAGE plpgsql
  SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.property_id IS DISTINCT FROM OLD.property_id THEN
    IF EXISTS (
      SELECT 1 FROM public.maintenance_requests mr
       WHERE mr.service_item_id = OLD.id
    ) THEN
      RAISE EXCEPTION
        'cannot move service item % to a different property: it is referenced by maintenance requests',
        OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lock_psi_property_id ON property_service_items;
CREATE TRIGGER trg_lock_psi_property_id
  BEFORE UPDATE OF property_id ON property_service_items
  FOR EACH ROW EXECUTE FUNCTION lock_psi_property_id();

-- ─── 7. capture_dispatch_authority() ──────────────────────────────────────────
-- BEFORE INSERT trigger on maintenance_requests.
-- Fail-safe: unlinked inserts (service_item_id IS NULL) always land with
-- captured_tenant_may_dispatch=false. A tenant cannot forge the flag by
-- supplying it in the INSERT payload.

CREATE OR REPLACE FUNCTION capture_dispatch_authority()
RETURNS trigger LANGUAGE plpgsql
  SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.service_item_id IS NULL THEN
    NEW.captured_tenant_may_dispatch := false;
    -- Unlinked requests cannot be in dispatch states; coerce to 'open'.
    IF NEW.status IN ('tenant_dispatching', 'awaiting_owner_dispatch', 'owner_dispatched') THEN
      NEW.status := 'open';
    END IF;
    RETURN NEW;
  END IF;

  SELECT tenant_may_dispatch
    INTO NEW.captured_tenant_may_dispatch
    FROM property_service_items
   WHERE id          = NEW.service_item_id
     AND property_id = NEW.property_id
     AND deleted_at  IS NULL;

  IF NEW.captured_tenant_may_dispatch IS NULL THEN
    RAISE EXCEPTION 'service_item_id does not belong to property_id';
  END IF;

  NEW.status := CASE
    WHEN NEW.captured_tenant_may_dispatch THEN 'tenant_dispatching'
    ELSE 'awaiting_owner_dispatch'
  END;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mr_capture_authority ON maintenance_requests;
CREATE TRIGGER trg_mr_capture_authority
  BEFORE INSERT ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION capture_dispatch_authority();

-- ─── 8. release_to_tenant_dispatch() RPC ──────────────────────────────────────
-- Single conditional UPDATE eliminates the TOCTOU race present in a
-- separate IF NOT EXISTS check + UPDATE pattern.

CREATE OR REPLACE FUNCTION release_to_tenant_dispatch(req_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.triage_in_progress', 'true', true);

  UPDATE public.maintenance_requests
     SET captured_tenant_may_dispatch = true,
         status                       = 'tenant_dispatching',
         updated_at                   = now()
   WHERE id       = req_id
     AND owner_id = auth.uid()
     AND status   = 'awaiting_owner_dispatch';

  IF NOT FOUND THEN
    PERFORM set_config('app.triage_in_progress', 'false', true);
    RAISE EXCEPTION 'not authorized or request not awaiting dispatch';
  END IF;

  PERFORM set_config('app.triage_in_progress', 'false', true);
END $$;

REVOKE ALL ON FUNCTION release_to_tenant_dispatch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION release_to_tenant_dispatch(uuid) TO authenticated;

-- ─── 9. reclaim_request() RPC ─────────────────────────────────────────────────
-- SELECT FOR UPDATE locks the request row. Assignments/POs are locked with a
-- separate PERFORM...FOR SHARE before the count query; PostgreSQL disallows
-- FOR SHARE on aggregate queries, so the lock and count are issued as two
-- statements against the same rows within the same transaction.
-- Source-state guard (AND status = 'tenant_dispatching') prevents reclaim
-- from reopening completed or cancelled requests.
-- Resets captured_tenant_may_dispatch=false and vendor_id=null so stale
-- authority and direct vendor references do not linger.

CREATE OR REPLACE FUNCTION reclaim_request(req_id uuid, reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  mr_owner_id      uuid;
  mr_vendor_id     uuid;
  open_assignments int;
  open_pos         int;
BEGIN
  -- Include owner_id = auth.uid() in the locking predicate so an unauthorized
  -- caller gets NOT FOUND before acquiring any lock — no timing side-channel
  -- and a single failure response regardless of whether the request exists,
  -- has the wrong state, or belongs to a different owner.
  SELECT owner_id, vendor_id INTO mr_owner_id, mr_vendor_id
    FROM public.maintenance_requests
   WHERE id       = req_id
     AND status   = 'tenant_dispatching'
     AND owner_id = auth.uid()
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found, not in a reclaimable state, or not authorized';
  END IF;

  -- Guard: if the request has a directly-set vendor_id with NO corresponding
  -- active assignment row, block the reclaim rather than silently NULLing it.
  -- When an assignment row exists the open_assignments check below already
  -- handles it; this guard catches the edge case where vendor_id was set
  -- without a corresponding assignment (e.g. by a future code path or migration).
  IF mr_vendor_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.maintenance_vendor_assignments
       WHERE request_id = req_id
         AND vendor_id  = mr_vendor_id
         AND status NOT IN ('cancelled', 'rejected')
    ) THEN
      RAISE EXCEPTION 'reclaim aborted: request.vendor_id is set but has no active assignment row; cancel the vendor association first';
    END IF;
  END IF;

  -- Step 1: Lock ALL assignment rows for this request (regardless of status).
  -- Clients cancel assignments via cancel_assignment() RPC, which acquires
  -- FOR SHARE on the parent before touching the child — same lock order as
  -- this function (parent FOR UPDATE first). Direct client UPDATEs on
  -- maintenance_vendor_assignments are restricted to service_role via mva_update.
  PERFORM id
    FROM public.maintenance_vendor_assignments
   WHERE request_id = req_id
   FOR SHARE;

  SELECT count(*) INTO open_assignments
    FROM public.maintenance_vendor_assignments
   WHERE request_id = req_id
     AND status NOT IN ('cancelled', 'rejected');

  IF open_assignments > 0 THEN
    RAISE EXCEPTION 'cancel open vendor assignments first';
  END IF;

  -- Step 2: same pattern for PO rows.
  PERFORM id
    FROM public.purchase_orders
   WHERE request_id = req_id
   FOR SHARE;

  SELECT count(*) INTO open_pos
    FROM public.purchase_orders
   WHERE request_id = req_id
     AND status NOT IN ('cancelled', 'closed');

  IF open_pos > 0 THEN
    RAISE EXCEPTION 'close or cancel open purchase orders first';
  END IF;

  PERFORM set_config('app.reclaim_in_progress', 'true', true);

  -- Step 3: Update the request. The FOR SHARE locks taken in steps 1–2 prevent any
  -- concurrent reactivation of a cancelled child from committing before we do, so
  -- the counts above are stable for the duration of this transaction.
  UPDATE public.maintenance_requests
     SET status                       = 'awaiting_owner_dispatch',
         captured_tenant_may_dispatch = false,
         vendor_id                    = NULL,
         owner_reclaim_reason         = reason,
         updated_at                   = now()
   WHERE id = req_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reclaim aborted: request state changed concurrently';
  END IF;

  PERFORM set_config('app.reclaim_in_progress', 'false', true);
END $$;

REVOKE ALL ON FUNCTION reclaim_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reclaim_request(uuid, text) TO authenticated;

-- ─── 10. RLS policy: maintenance_requests INSERT ──────────────────────────────

DROP POLICY IF EXISTS mr_insert ON maintenance_requests;
CREATE POLICY mr_insert ON maintenance_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    -- owner path
    (owner_id = auth.uid()
     AND EXISTS (SELECT 1 FROM properties p
                 WHERE p.id = maintenance_requests.property_id
                   AND p.owner_id = auth.uid()))
    OR
    -- tenant path: must have an active lease and owner_id must match the
    -- property's actual owner (blocks forging owner_id).
    (tenant_id = auth.uid()
     AND EXISTS (
       SELECT 1 FROM leases l
       JOIN properties p ON p.id = l.property_id
       WHERE l.tenant_id   = auth.uid()
         AND l.property_id = maintenance_requests.property_id
         AND l.status      = 'active'
         AND p.owner_id    = maintenance_requests.owner_id))
    AND (vendor_id IS NULL
         OR captured_tenant_may_dispatch = true
         OR maintenance_requests.owner_id = auth.uid())
  );

-- ─── 11. RLS policy: maintenance_requests UPDATE ──────────────────────────────
-- Non-owners cannot produce status=awaiting_owner_dispatch via direct UPDATE.
-- Only reclaim_request() (which sets app.reclaim_in_progress) may do so.

DROP POLICY IF EXISTS mr_update ON maintenance_requests;
CREATE POLICY mr_update ON maintenance_requests
  FOR UPDATE TO authenticated
  USING  (tenant_id = auth.uid() OR owner_id = auth.uid())
  WITH CHECK (
    -- Immutable identity columns
    tenant_id   = (SELECT tenant_id   FROM maintenance_requests mr2 WHERE mr2.id = maintenance_requests.id)
    AND owner_id    = (SELECT owner_id    FROM maintenance_requests mr2 WHERE mr2.id = maintenance_requests.id)
    AND property_id = (SELECT property_id FROM maintenance_requests mr2 WHERE mr2.id = maintenance_requests.id)
    AND service_item_id IS NOT DISTINCT FROM
        (SELECT service_item_id FROM maintenance_requests mr2 WHERE mr2.id = maintenance_requests.id)
    -- Dispatch flag is immutable after insert (RPCs manage it directly)
    AND captured_tenant_may_dispatch =
        (SELECT captured_tenant_may_dispatch FROM maintenance_requests mr2 WHERE mr2.id = maintenance_requests.id)
    -- Vendor-hire: tenant may only set vendor_id when they have dispatch authority
    AND (vendor_id IS NULL
         OR captured_tenant_may_dispatch = true
         OR owner_id = auth.uid())
    -- Non-owners cannot transition status TO awaiting_owner_dispatch (but
    -- may leave it there via description-only or other non-status updates).
    AND (
      owner_id = auth.uid()
      OR status != 'awaiting_owner_dispatch'
      OR status = (SELECT mr2.status FROM maintenance_requests mr2 WHERE mr2.id = maintenance_requests.id)
      OR current_setting('app.reclaim_in_progress', true) = 'true'
    )
  );

