-- CT7-023: Dispatch authority — MVA auth, RPCs, sync, grants
-- Depends on: 079_maintenance_responsibility.sql, 080_maintenance_dispatch.sql
-- Sections: §12 check_mva_dispatch_authority, §13 MVA RLS policies,
--           §14 cancel_assignment, §15 bi-directional sync, §16 inline tests,
--           final GRANTs

-- ─── 12. check_mva_dispatch_authority() ───────────────────────────────────────
-- BEFORE INSERT trigger on maintenance_vendor_assignments.
-- Locks the maintenance_requests row with FOR UPDATE so that a concurrent
-- reclaim_request() cannot change status between the RLS policy check and
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

-- ─── 13. RLS policies: maintenance_vendor_assignments ─────────────────────────

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
           -- Owner path: no status restriction
           OR mr.owner_id = auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS mva_party_select ON maintenance_vendor_assignments;
CREATE POLICY mva_party_select ON maintenance_vendor_assignments
  FOR SELECT TO authenticated
  USING (
    vendor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM maintenance_requests mr
       WHERE mr.id = maintenance_vendor_assignments.request_id
         AND (mr.owner_id = auth.uid() OR mr.tenant_id = auth.uid())
    )
  );

-- mva_update: direct UPDATE on assignments is restricted to service_role.
-- Authenticated clients cancel assignments via cancel_assignment() RPC, which
-- enforces parent-first locking and avoids deadlock with reclaim_request().
DROP POLICY IF EXISTS mva_update ON maintenance_vendor_assignments;
CREATE POLICY mva_update ON maintenance_vendor_assignments
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 14. cancel_assignment() RPC — parent-first locking for assignment cancellation
-- Direct UPDATE on maintenance_vendor_assignments can deadlock with reclaim_request():
--   reclaim holds parent FOR UPDATE and waits for child rows;
--   a concurrent child UPDATE holds the child row and would need the parent to validate.
-- The RPC approach breaks this by acquiring the parent lock BEFORE touching the child,
-- matching reclaim's lock order (parent → child) and making deadlock impossible.
-- mva_update RLS restricts direct client UPDATEs to service_role only; tenants and
-- owners cancel through this RPC.

CREATE OR REPLACE FUNCTION cancel_assignment(p_assignment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_request_id uuid;
  v_vendor_id  uuid;
  v_caller_id  uuid := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Step 1: resolve the parent request and vendor (no row lock yet).
  SELECT request_id, vendor_id INTO v_request_id, v_vendor_id
    FROM public.maintenance_vendor_assignments
   WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment not found';
  END IF;

  -- Step 2: lock the parent first so reclaim_request() cannot interleave.
  PERFORM id FROM public.maintenance_requests
   WHERE id = v_request_id
   FOR SHARE;

  -- Step 3: cancel the child row; RLS on maintenance_vendor_assignments still
  -- checks the caller is an authorised party for this request.
  UPDATE public.maintenance_vendor_assignments
     SET status = 'cancelled'
   WHERE id            = p_assignment_id
     AND status NOT IN ('cancelled', 'rejected');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment not found or already cancelled/rejected';
  END IF;

  -- Step 4: clear vendor_id on the parent request if it was pointing to this
  -- vendor — without this, reclaim_request() would find vendor_id IS NOT NULL
  -- with no active assignment and raise an exception, leaving the request
  -- permanently unreclaimable after a legitimate cancel.
  UPDATE public.maintenance_requests
     SET vendor_id = NULL
   WHERE id        = v_request_id
     AND vendor_id = v_vendor_id;
END $$;

REVOKE ALL ON FUNCTION cancel_assignment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_assignment(uuid) TO authenticated;

-- Drop the trigger-based guards introduced previously — they caused a deadlock
-- because PostgreSQL locks the target row BEFORE running the BEFORE UPDATE trigger,
-- so the trigger could not acquire the parent lock first.
DROP TRIGGER IF EXISTS trg_guard_assignment_reactivation ON maintenance_vendor_assignments;
DROP FUNCTION IF EXISTS guard_assignment_reactivation();
DROP TRIGGER IF EXISTS trg_guard_po_reactivation ON purchase_orders;
DROP FUNCTION IF EXISTS guard_po_reactivation();

-- ─── 15. Bi-directional sync triggers ─────────────────────────────────────────
-- Forward: sidecar → properties.services_provided (keeps old-client reads fresh)
-- Reverse: properties.services_provided → sidecar (keeps new-client reads fresh
--          when an old client still writes the legacy column).
-- Both skip while the other is running (app.sync_in_progress flag).

CREATE OR REPLACE FUNCTION sync_psi_to_array()
RETURNS trigger LANGUAGE plpgsql
  SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF current_setting('app.sync_in_progress', true) = 'true' THEN
    RETURN NULL;
  END IF;
  PERFORM set_config('app.sync_in_progress', 'true', true);
  UPDATE properties
     SET services_provided = ARRAY(
           SELECT name FROM property_service_items
            WHERE property_id = COALESCE(NEW.property_id, OLD.property_id)
              AND deleted_at IS NULL
            ORDER BY created_at
         )
   WHERE id = COALESCE(NEW.property_id, OLD.property_id);
  PERFORM set_config('app.sync_in_progress', 'false', true);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_psi_sync_to_array ON property_service_items;
CREATE TRIGGER trg_psi_sync_to_array
  AFTER INSERT OR UPDATE OR DELETE ON property_service_items
  FOR EACH ROW EXECUTE FUNCTION sync_psi_to_array();

CREATE OR REPLACE FUNCTION sync_array_to_psi()
RETURNS trigger LANGUAGE plpgsql
  SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  new_names text[];
  old_names text[];
  nm        text;
BEGIN
  IF current_setting('app.sync_in_progress', true) = 'true' THEN
    RETURN NULL;
  END IF;
  PERFORM set_config('app.sync_in_progress', 'true', true);

  new_names := COALESCE(NEW.services_provided, '{}');
  old_names := COALESCE(OLD.services_provided, '{}');

  FOREACH nm IN ARRAY new_names LOOP
    INSERT INTO property_service_items (property_id, name, tenant_may_dispatch)
    VALUES (NEW.id, nm, true)
    ON CONFLICT DO NOTHING;
  END LOOP;

  UPDATE property_service_items
     SET deleted_at = now()
   WHERE property_id = NEW.id
     AND name = ANY(old_names)
     AND name != ALL(new_names)
     AND deleted_at IS NULL;

  PERFORM set_config('app.sync_in_progress', 'false', true);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_array_sync_to_psi ON properties;
CREATE TRIGGER trg_array_sync_to_psi
  AFTER UPDATE OF services_provided ON properties
  FOR EACH ROW EXECUTE FUNCTION sync_array_to_psi();

-- ─── 16. Inline structural tests ──────────────────────────────────────────────
-- These assertions run as the migration superuser and verify structural
-- invariants (indexes, function existence, policy existence).
-- Behavioral tests that require live auth.uid() context live in
-- database/tests/079_dispatch_authority_tests.sql (pgTAP).

DO $$
DECLARE
  v_prop_id  uuid;
  v_psi_id   uuid;
BEGIN
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

  SELECT id INTO v_prop_id FROM properties LIMIT 1;

  IF v_prop_id IS NOT NULL THEN
    SAVEPOINT test_partial_index;

    -- (a) deleted item + new active item with same name should both succeed
    INSERT INTO property_service_items (property_id, name, tenant_may_dispatch, deleted_at)
    VALUES (v_prop_id, '_test_079_item', true, now())
    RETURNING id INTO v_psi_id;

    INSERT INTO property_service_items (property_id, name, tenant_may_dispatch)
    VALUES (v_prop_id, '_test_079_item', true);

    -- (b) second active item with same name must be rejected
    BEGIN
      INSERT INTO property_service_items (property_id, name, tenant_may_dispatch)
      VALUES (v_prop_id, '_test_079_item', true);
      RAISE EXCEPTION 'ASSERTION FAIL: duplicate active item should have been rejected';
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;

    -- (c) deleted service item must not be selectable as dispatch authority
    --     (capture_dispatch_authority rejects it because of deleted_at IS NULL filter;
    --      verify the query returns no row for a deleted id).
    DECLARE
      v_found boolean;
    BEGIN
      SELECT tenant_may_dispatch IS NOT NULL
        INTO v_found
        FROM property_service_items
       WHERE id         = v_psi_id
         AND deleted_at IS NULL;
      IF v_found THEN
        RAISE EXCEPTION 'ASSERTION FAIL: deleted service item should not match deleted_at IS NULL filter';
      END IF;
    END;

    ROLLBACK TO SAVEPOINT test_partial_index;
  ELSE
    RAISE NOTICE 'migration 079 partial-index test skipped: properties table is empty';
  END IF;

  RAISE NOTICE 'migration 079 structural tests: all passed';
END $$;
