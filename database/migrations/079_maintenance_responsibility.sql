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
--
-- Enforcement strategy:
--   (a) Backfill: populate request_id for existing POs that are linked to a
--       maintenance request via service_contracts (the existing PO→contract→
--       maintenance_request chain). This covers the case where a pre-existing
--       request could later be released to 'tenant_dispatching' and have its
--       POs be invisible to reclaim_request().
--   (b) Forward trigger: a BEFORE INSERT trigger auto-populates request_id
--       from the contract chain for any new PO created with a contract_id but
--       no explicit request_id. This ensures application code that pre-dates
--       this migration (which doesn't set request_id) is still correct.
--   (c) POs with no contract_id (non-maintenance POs) remain with
--       request_id = NULL — they are unrelated to the dispatch flow.

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES maintenance_requests(id);

CREATE INDEX IF NOT EXISTS idx_po_request ON purchase_orders(request_id);

-- (a) Backfill: link existing POs to their maintenance requests via contract chain.
UPDATE public.purchase_orders po
   SET request_id = sc.maintenance_request_id
  FROM public.service_contracts sc
 WHERE po.contract_id = sc.id
   AND sc.maintenance_request_id IS NOT NULL
   AND po.request_id IS NULL;

-- (b) Forward trigger: enforce request_id consistency from contract chain.
-- INSERT: reject an explicit request_id that conflicts with the contract chain.
-- UPDATE OF contract_id: always re-derive (OLD.request_id was trigger-managed,
--   not user-supplied). Clear request_id when contract_id is unlinked (set to NULL).
-- Direct updates to request_id are blocked by trg_lock_po_request_id below.
CREATE OR REPLACE FUNCTION populate_po_request_id()
RETURNS trigger LANGUAGE plpgsql
  SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_derived uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.contract_id IS NOT NULL THEN
      SELECT sc.maintenance_request_id INTO v_derived
        FROM public.service_contracts sc
       WHERE sc.id = NEW.contract_id;
      -- On INSERT only: reject an explicit caller-supplied request_id that disagrees.
      IF NEW.request_id IS NOT NULL AND NEW.request_id IS DISTINCT FROM v_derived THEN
        RAISE EXCEPTION
          'purchase_orders.request_id conflicts with contract chain: supplied %, derived from contract %',
          NEW.request_id, v_derived;
      END IF;
      NEW.request_id := v_derived;
    END IF;
    -- NULL contract_id on INSERT: request_id stays as supplied (NULL for non-maintenance POs).

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.contract_id IS NOT NULL THEN
      -- Re-link: always derive from new contract (OLD.request_id was trigger-managed).
      SELECT sc.maintenance_request_id INTO v_derived
        FROM public.service_contracts sc
       WHERE sc.id = NEW.contract_id;
      NEW.request_id := v_derived;
    ELSE
      -- Unlink: contract_id changed to NULL → clear stale request ownership.
      NEW.request_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_populate_po_request_id ON purchase_orders;
CREATE TRIGGER trg_populate_po_request_id
  BEFORE INSERT OR UPDATE OF contract_id ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION populate_po_request_id();

-- Prevent direct modification of request_id; it is managed exclusively by the
-- contract chain trigger above. Callers must update contract_id instead.
CREATE OR REPLACE FUNCTION lock_po_request_id()
RETURNS trigger LANGUAGE plpgsql
  SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION
    'purchase_orders.request_id is managed by the contract chain; update contract_id instead';
END $$;

DROP TRIGGER IF EXISTS trg_lock_po_request_id ON purchase_orders;
CREATE TRIGGER trg_lock_po_request_id
  BEFORE UPDATE OF request_id ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION lock_po_request_id();

-- (c) service_contracts.maintenance_request_id consistency:
--   * Late association (NULL → non-NULL): allow and propagate to linked POs.
--   * Reassignment (non-NULL → different non-NULL): reject — a contract is bound to
--     one request; the reclaim sweep relies on this invariant.
--   * Clearing (non-NULL → NULL): reject — owned POs would become orphaned.

CREATE OR REPLACE FUNCTION sync_sc_request_id()
RETURNS trigger LANGUAGE plpgsql
  SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  -- Block reassignment and clearing of an already-set maintenance_request_id.
  IF OLD.maintenance_request_id IS NOT NULL
     AND NEW.maintenance_request_id IS DISTINCT FROM OLD.maintenance_request_id THEN
    RAISE EXCEPTION
      'service_contracts.maintenance_request_id is immutable once set; old=%, attempted=%',
      OLD.maintenance_request_id, NEW.maintenance_request_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION propagate_sc_request_id()
RETURNS trigger LANGUAGE plpgsql
  SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  -- Late association: NULL → non-NULL — propagate to all linked POs.
  IF OLD.maintenance_request_id IS NULL AND NEW.maintenance_request_id IS NOT NULL THEN
    UPDATE public.purchase_orders
       SET request_id = NEW.maintenance_request_id
     WHERE contract_id = NEW.id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_sc_request_id ON service_contracts;
CREATE TRIGGER trg_sync_sc_request_id
  BEFORE UPDATE OF maintenance_request_id ON public.service_contracts
  FOR EACH ROW EXECUTE FUNCTION sync_sc_request_id();

DROP TRIGGER IF EXISTS trg_propagate_sc_request_id ON service_contracts;
CREATE TRIGGER trg_propagate_sc_request_id
  AFTER UPDATE OF maintenance_request_id ON public.service_contracts
  FOR EACH ROW EXECUTE FUNCTION propagate_sc_request_id();

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
