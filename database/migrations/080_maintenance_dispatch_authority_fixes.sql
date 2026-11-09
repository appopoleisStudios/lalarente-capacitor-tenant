-- CT7-023 security hardening: dispatch authority fixes
-- Addresses SA CHANGES_REQUESTED on PR #210.
--
-- Changes:
--   1. capture_dispatch_authority() – fail-safe: force captured_tenant_may_dispatch=false
--      when service_item_id IS NULL (prevents tenant forging the flag on insert)
--   2. reclaim_request() – SELECT FOR UPDATE to serialise concurrent assign/reclaim;
--      set captured_tenant_may_dispatch=false on reclaim
--   3. release_to_tenant_dispatch() – single conditional UPDATE (eliminates TOCTOU)
--   4. mr_update policy – block ALL non-owner paths to awaiting_owner_dispatch
--   5. mva_insert policy – require status=tenant_dispatching for tenant path
--   6. check_mva_dispatch_authority() BEFORE INSERT trigger – FOR UPDATE lock on
--      maintenance_requests to serialise concurrent reclaim and assignment
--   7. mva_update policy – allow owners/dispatching-tenants to cancel assignments
--   8. Partial unique index on property_service_items(property_id, name)

-- ─── 1. capture_dispatch_authority() ─────────────────────────────────────────
-- Fail-safe: unlinked inserts always land with captured_tenant_may_dispatch=false.
-- A tenant cannot forge the flag by supplying it in the INSERT payload.

CREATE OR REPLACE FUNCTION capture_dispatch_authority()
RETURNS trigger LANGUAGE plpgsql
  SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.service_item_id IS NULL THEN
    -- Unlinked request: tenant never had explicit dispatch authority.
    -- Force false regardless of what the caller supplied.
    NEW.captured_tenant_may_dispatch := false;
    RETURN NEW;
  END IF;

  SELECT tenant_may_dispatch
    INTO NEW.captured_tenant_may_dispatch
    FROM property_service_items
   WHERE id          = NEW.service_item_id
     AND property_id = NEW.property_id;

  IF NEW.captured_tenant_may_dispatch IS NULL THEN
    RAISE EXCEPTION 'service_item_id does not belong to property_id';
  END IF;

  NEW.status := CASE
    WHEN NEW.captured_tenant_may_dispatch THEN 'tenant_dispatching'
    ELSE 'awaiting_owner_dispatch'
  END;

  RETURN NEW;
END $$;

-- ─── 2. release_to_tenant_dispatch() ─────────────────────────────────────────
-- Replaced IF NOT EXISTS + separate UPDATE with a single conditional UPDATE.
-- If 0 rows affected, the request was not in the right state → exception.

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

-- ─── 3. reclaim_request() ─────────────────────────────────────────────────────
-- SELECT FOR UPDATE locks the request row before counting open assignments/POs,
-- preventing a concurrent tenant assignment from slipping in between the check
-- and the status update.
-- Also resets captured_tenant_may_dispatch=false so stale authority doesn't linger.

CREATE OR REPLACE FUNCTION reclaim_request(req_id uuid, reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  mr_owner_id      uuid;
  open_assignments int;
  open_pos         int;
BEGIN
  -- Lock the row; also verifies ownership in one round-trip.
  SELECT owner_id INTO mr_owner_id
    FROM public.maintenance_requests
   WHERE id = req_id
   FOR UPDATE;

  IF mr_owner_id IS NULL OR mr_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT count(*) INTO open_assignments
    FROM public.maintenance_vendor_assignments
   WHERE request_id = req_id
     AND status NOT IN ('cancelled', 'rejected');

  IF open_assignments > 0 THEN
    RAISE EXCEPTION 'cancel open vendor assignments first';
  END IF;

  SELECT count(*) INTO open_pos
    FROM public.purchase_orders
   WHERE request_id = req_id
     AND status NOT IN ('cancelled', 'closed');

  IF open_pos > 0 THEN
    RAISE EXCEPTION 'close or cancel open purchase orders first';
  END IF;

  PERFORM set_config('app.reclaim_in_progress', 'true', true);

  UPDATE public.maintenance_requests
     SET status                       = 'awaiting_owner_dispatch',
         captured_tenant_may_dispatch = false,
         owner_reclaim_reason         = reason,
         updated_at                   = now()
   WHERE id = req_id;

  PERFORM set_config('app.reclaim_in_progress', 'false', true);
END $$;

REVOKE ALL ON FUNCTION reclaim_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reclaim_request(uuid, text) TO authenticated;

-- ─── 4. mr_update policy ─────────────────────────────────────────────────────
-- Replaces the transition-based guard with a simpler invariant:
-- only owners (or the reclaim RPC) may ever produce status=awaiting_owner_dispatch.

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
    -- Non-owners cannot produce awaiting_owner_dispatch via direct UPDATE
    -- (reclaim_request() bypasses this via app.reclaim_in_progress)
    AND (
      owner_id = auth.uid()
      OR status != 'awaiting_owner_dispatch'
      OR current_setting('app.reclaim_in_progress', true) = 'true'
    )
  );

-- ─── 5. mva_insert policy ─────────────────────────────────────────────────────
-- Adds status = 'tenant_dispatching' guard for the tenant path, so a stale
-- captured_tenant_may_dispatch=true value (before fix #3 landed on old rows)
-- cannot be exploited after a reclaim.

DROP POLICY IF EXISTS mva_insert ON maintenance_vendor_assignments;
CREATE POLICY mva_insert ON maintenance_vendor_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM maintenance_requests mr
       WHERE mr.id = maintenance_vendor_assignments.request_id
         AND (
           -- Tenant path: request must still be in tenant_dispatching state
           (mr.status = 'tenant_dispatching'
            AND mr.captured_tenant_may_dispatch = true
            AND mr.tenant_id = auth.uid())
           -- Owner path: no status restriction (owner may assign at any stage)
           OR mr.owner_id = auth.uid()
         )
    )
  );

-- ─── 6. check_mva_dispatch_authority() BEFORE INSERT trigger ─────────────────
-- Locks the maintenance_requests row with FOR UPDATE so that a concurrent
-- reclaim_request() cannot change the status between the RLS policy check and
-- the actual row insertion.

CREATE OR REPLACE FUNCTION check_mva_dispatch_authority()
RETURNS trigger LANGUAGE plpgsql
  SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  mr maintenance_requests;
BEGIN
  SELECT * INTO mr
    FROM public.maintenance_requests
   WHERE id = NEW.request_id
   FOR UPDATE;

  IF mr IS NULL THEN
    RAISE EXCEPTION 'maintenance request not found';
  END IF;

  IF mr.owner_id = auth.uid() THEN
    -- Owner may assign at any stage; nothing to check.
    RETURN NEW;
  END IF;

  IF mr.tenant_id = auth.uid() THEN
    IF mr.status != 'tenant_dispatching' THEN
      RAISE EXCEPTION 'request is no longer in tenant_dispatching state';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'not authorized to assign vendors for this request';
END $$;

DROP TRIGGER IF EXISTS trg_mva_check_authority ON maintenance_vendor_assignments;
CREATE TRIGGER trg_mva_check_authority
  BEFORE INSERT ON maintenance_vendor_assignments
  FOR EACH ROW EXECUTE FUNCTION check_mva_dispatch_authority();

-- ─── 7. mva_update policy ─────────────────────────────────────────────────────
-- Allows the dispatching party to cancel an assignment.
-- Only the status column may change (to 'cancelled'); request_id and vendor_id
-- are treated as immutable.

DROP POLICY IF EXISTS mva_update ON maintenance_vendor_assignments;
CREATE POLICY mva_update ON maintenance_vendor_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_requests mr
       WHERE mr.id = maintenance_vendor_assignments.request_id
         AND (
           (mr.status = 'tenant_dispatching'
            AND mr.captured_tenant_may_dispatch = true
            AND mr.tenant_id = auth.uid())
           OR mr.owner_id = auth.uid()
         )
    )
  )
  WITH CHECK (
    status     = 'cancelled'
    AND request_id = (SELECT request_id FROM maintenance_vendor_assignments mva2
                       WHERE mva2.id = maintenance_vendor_assignments.id)
    AND vendor_id  = (SELECT vendor_id  FROM maintenance_vendor_assignments mva2
                       WHERE mva2.id = maintenance_vendor_assignments.id)
  );

-- ─── 8. Partial unique index on property_service_items ───────────────────────
-- Guarantees the backfill ON CONFLICT clause works correctly and prevents
-- duplicate active service items per property.

CREATE UNIQUE INDEX IF NOT EXISTS idx_psi_property_name_active
  ON property_service_items(property_id, name)
  WHERE deleted_at IS NULL;

-- ─── 9. Inline structural tests ──────────────────────────────────────────────
-- These assertions run as the migration superuser and verify structural
-- invariants (indexes, function existence, policy existence).
-- Behavioral tests that require live auth.uid() context live in
-- database/tests/080_dispatch_authority_tests.sql (pgTAP).

DO $$
DECLARE
  v_prop_id  uuid;
  v_psi_id   uuid;
BEGIN
  -- ── Test 1: required objects exist ────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename  = 'property_service_items'
       AND indexname  = 'idx_psi_property_name_active'
  ) THEN
    RAISE EXCEPTION 'ASSERTION FAIL: idx_psi_property_name_active not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'capture_dispatch_authority'
  ) THEN
    RAISE EXCEPTION 'ASSERTION FAIL: capture_dispatch_authority function not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'check_mva_dispatch_authority'
  ) THEN
    RAISE EXCEPTION 'ASSERTION FAIL: check_mva_dispatch_authority function not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mva_check_authority'
  ) THEN
    RAISE EXCEPTION 'ASSERTION FAIL: trg_mva_check_authority trigger not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename  = 'maintenance_vendor_assignments'
       AND policyname = 'mva_update'
  ) THEN
    RAISE EXCEPTION 'ASSERTION FAIL: mva_update policy not found';
  END IF;

  -- ── Test 2: partial unique index correctly scopes to active rows ──────────
  -- Insert two property_service_items with the same name but different
  -- deleted_at: should not conflict (partial index only covers deleted_at IS NULL).
  --
  -- Requires a valid property_id. Use the first row in properties if any exist;
  -- skip this test if the table is empty (fresh schema with no seed data).
  SELECT id INTO v_prop_id FROM properties LIMIT 1;

  IF v_prop_id IS NOT NULL THEN
    SAVEPOINT test2;

    INSERT INTO property_service_items (property_id, name, tenant_may_dispatch, deleted_at)
    VALUES (v_prop_id, '_test_080_item', true, now())
    RETURNING id INTO v_psi_id;

    -- Second insert with same name and no deleted_at should succeed (deleted row
    -- does not conflict under the partial index).
    INSERT INTO property_service_items (property_id, name, tenant_may_dispatch)
    VALUES (v_prop_id, '_test_080_item', true);

    -- Third insert with same name and no deleted_at SHOULD conflict.
    BEGIN
      INSERT INTO property_service_items (property_id, name, tenant_may_dispatch)
      VALUES (v_prop_id, '_test_080_item', true);
      RAISE EXCEPTION 'ASSERTION FAIL: duplicate active item should have been rejected';
    EXCEPTION WHEN unique_violation THEN
      NULL; -- expected
    END;

    ROLLBACK TO SAVEPOINT test2;
  ELSE
    RAISE NOTICE 'migration 080 test 2 skipped: properties table is empty';
  END IF;

  RAISE NOTICE 'migration 080 structural tests: all passed';
END $$;
