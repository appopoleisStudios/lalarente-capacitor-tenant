-- CT7-023: Owner vs tenant maintenance responsibility + vendor-hire rights
-- Introduces property_service_items sidecar, dispatch-authority snapshot,
-- state-machine enum values, maintenance_vendor_assignments table, and
-- server-side RPCs (reclaim_request, release_to_tenant_dispatch).
--
-- All SA CHANGES_REQUESTED findings have been incorporated directly.
-- A separate migration 080 is no longer needed.

-- ─── 1. property_service_items sidecar ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS property_service_items (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         uuid        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  tenant_may_dispatch boolean     NOT NULL DEFAULT true,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psi_property ON property_service_items(property_id);

-- Partial unique index: only one active (non-deleted) row per (property, name).
CREATE UNIQUE INDEX IF NOT EXISTS idx_psi_property_name_active
  ON property_service_items(property_id, name)
  WHERE deleted_at IS NULL;

ALTER TABLE property_service_items ENABLE ROW LEVEL SECURITY;

-- Backfill: seed one row per existing services_provided entry with
-- tenant_may_dispatch = true (preserves today's behaviour).
INSERT INTO property_service_items (property_id, name, tenant_may_dispatch)
SELECT id, unnest(services_provided), true
FROM   properties
WHERE  services_provided IS NOT NULL AND array_length(services_provided, 1) > 0
ON CONFLICT DO NOTHING;

-- ─── 2. Extend maintenance_status enum ────────────────────────────────────────

ALTER TYPE maintenance_status ADD VALUE IF NOT EXISTS 'awaiting_owner_dispatch';
ALTER TYPE maintenance_status ADD VALUE IF NOT EXISTS 'tenant_dispatching';
ALTER TYPE maintenance_status ADD VALUE IF NOT EXISTS 'owner_dispatched';

-- ─── 3. New columns on maintenance_requests ───────────────────────────────────

ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS service_item_id              uuid        REFERENCES property_service_items(id),
  ADD COLUMN IF NOT EXISTS captured_tenant_may_dispatch boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_reclaim_reason          text;

-- ─── 4. maintenance_vendor_assignments ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS maintenance_vendor_assignments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid        NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  vendor_id   uuid        NOT NULL REFERENCES profiles(id),
  status      text        NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_mva_request ON maintenance_vendor_assignments(request_id);

ALTER TABLE maintenance_vendor_assignments ENABLE ROW LEVEL SECURITY;

-- ─── 5. Add request_id to purchase_orders ─────────────────────────────────────
-- Allows reclaim_request() to sweep all POs for a request regardless of
-- which assignment originally produced them.

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES maintenance_requests(id);

CREATE INDEX IF NOT EXISTS idx_po_request ON purchase_orders(request_id);

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
  SELECT owner_id, vendor_id INTO mr_owner_id, mr_vendor_id
    FROM public.maintenance_requests
   WHERE id     = req_id
     AND status = 'tenant_dispatching'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found, not in a reclaimable state, or already terminal';
  END IF;

  IF mr_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Lock qualifying assignment rows first, then count outside the locking
  -- clause. PostgreSQL does not allow FOR SHARE on aggregate queries.
  PERFORM id
    FROM public.maintenance_vendor_assignments
   WHERE request_id = req_id
     AND status NOT IN ('cancelled', 'rejected')
   FOR SHARE;

  SELECT count(*) INTO open_assignments
    FROM public.maintenance_vendor_assignments
   WHERE request_id = req_id
     AND status NOT IN ('cancelled', 'rejected');

  IF open_assignments > 0 THEN
    RAISE EXCEPTION 'cancel open vendor assignments first';
  END IF;

  -- Lock PO rows for the same reason.
  PERFORM id
    FROM public.purchase_orders
   WHERE request_id = req_id
     AND status NOT IN ('cancelled', 'closed')
   FOR SHARE;

  SELECT count(*) INTO open_pos
    FROM public.purchase_orders
   WHERE request_id = req_id
     AND status NOT IN ('cancelled', 'closed');

  IF open_pos > 0 THEN
    RAISE EXCEPTION 'close or cancel open purchase orders first';
  END IF;

  -- Block reclaim if tenant set vendor_id directly (without an assignment row).
  -- vendor_id is cleared atomically in the UPDATE below.
  IF mr_vendor_id IS NOT NULL AND open_assignments = 0 THEN
    -- vendor_id set without a tracking assignment — clear it as part of reclaim.
    NULL; -- falls through to the UPDATE which sets vendor_id = NULL
  END IF;

  PERFORM set_config('app.reclaim_in_progress', 'true', true);

  UPDATE public.maintenance_requests
     SET status                       = 'awaiting_owner_dispatch',
         captured_tenant_may_dispatch = false,
         vendor_id                    = NULL,
         owner_reclaim_reason         = reason,
         updated_at                   = now()
   WHERE id = req_id;

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

-- ─── 14. Bi-directional sync triggers ─────────────────────────────────────────
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

-- ─── 15. Inline structural tests ──────────────────────────────────────────────
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
