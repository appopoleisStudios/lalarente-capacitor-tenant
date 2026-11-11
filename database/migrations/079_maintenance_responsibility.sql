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
-- Lateral unnest with alias filters NULL elements before the NOT NULL constraint fires;
-- ON CONFLICT DO NOTHING handles duplicate names on the same property.
INSERT INTO property_service_items (property_id, name, tenant_may_dispatch)
SELECT p.id, elem, true
FROM   properties p, unnest(p.services_provided) AS elem
WHERE  p.services_provided IS NOT NULL AND array_length(p.services_provided, 1) > 0
  AND  elem IS NOT NULL
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
-- INSERT or UPDATE with CHANGING contract_id (A→B): use FOR SHARE on the new contract.
--   FOR SHARE blocks any concurrent UPDATE of the contract (which needs NO KEY UPDATE,
--   incompatible with FOR SHARE) until this PO INSERT/re-link commits. After that, the
--   contract UPDATE's propagation sees the committed PO and corrects request_id.
--   No deadlock: the propagation's WHERE contract_id = B scan cannot include this PO
--   (it still has contract_id = A), so the propagation never waits for this PO's lock.
-- UPDATE with SAME contract_id (propagation path: SET contract_id = contract_id):
--   plain SELECT. The contract lock is already held by the same transaction; FOR SHARE
--   would deadlock if another transaction's propagation needed to lock this same PO.
-- UPDATE OF contract_id to NULL: reject if PO already has maintenance request_id.
-- Direct updates to request_id are blocked unconditionally by trg_lock_po_request_id.
-- SECURITY DEFINER: SELECT ... FOR SHARE requires UPDATE privilege on the locked table.
-- Callers who can INSERT purchase_orders and read service_contracts but cannot UPDATE
-- service_contracts would fail without this. Running as the function owner (postgres)
-- ensures the FOR SHARE locking always succeeds regardless of the caller's privileges.
CREATE OR REPLACE FUNCTION populate_po_request_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_derived uuid;
BEGIN
  IF NEW.contract_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' OR NEW.contract_id IS DISTINCT FROM OLD.contract_id THEN
      -- FOR SHARE: serializes with concurrent service_contracts maintenance_request_id
      -- updates on the new contract. Lock is safe: propagation's WHERE contract_id = B
      -- cannot match this PO (which has the old contract_id), so no inversion occurs.
      SELECT sc.maintenance_request_id INTO v_derived
        FROM public.service_contracts sc
       WHERE sc.id = NEW.contract_id
         FOR SHARE;
    ELSE
      -- Propagation path (SET contract_id = contract_id, value unchanged): plain SELECT.
      -- The propagation trigger holds the contract lock in the same transaction already.
      SELECT sc.maintenance_request_id INTO v_derived
        FROM public.service_contracts sc
       WHERE sc.id = NEW.contract_id;
    END IF;

    -- Fail closed: contract not found (FK prevents non-existent IDs; this guards against a
    -- caller supplying a UUID that passes FK but is somehow absent from the heap).
    IF NOT FOUND THEN
      RAISE EXCEPTION
        'contract % not found; cannot verify maintenance request linkage',
        NEW.contract_id;
    END IF;

    IF TG_OP = 'INSERT' THEN
      -- Do not expose v_derived in the error: SECURITY DEFINER bypasses RLS, so
      -- revealing the derived maintenance_request_id would allow a caller with only
      -- INSERT privilege to probe foreign contract linkages via error messages.
      IF NEW.request_id IS NOT NULL AND NEW.request_id IS DISTINCT FROM v_derived THEN
        RAISE EXCEPTION
          'purchase_orders.request_id conflicts with the contract chain for contract %',
          NEW.contract_id;
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Reject re-linking to a different or NULL maintenance chain.
      -- Error does not expose v_derived for the same SECURITY DEFINER reason above.
      IF OLD.request_id IS NOT NULL AND v_derived IS DISTINCT FROM OLD.request_id THEN
        RAISE EXCEPTION
          'cannot re-link a maintenance-linked PO to a contract with a different chain (contract %)',
          NEW.contract_id;
      END IF;
    END IF;
    NEW.request_id := v_derived;

  ELSE
    -- contract_id = NULL
    -- Reject INSERT with explicit request_id: maintenance linkage requires a contract.
    -- Silently clearing it would make the PO invisible to the reclaim sweep.
    IF TG_OP = 'INSERT' AND NEW.request_id IS NOT NULL THEN
      RAISE EXCEPTION
        'cannot set request_id without a contract_id; maintenance linkage requires a service contract';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.request_id IS NOT NULL THEN
      RAISE EXCEPTION
        'cannot remove contract from a maintenance-linked PO (request_id=%) — it would disappear from the reclaim sweep',
        OLD.request_id;
    END IF;
    NEW.request_id := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_populate_po_request_id ON purchase_orders;
CREATE TRIGGER trg_populate_po_request_id
  BEFORE INSERT OR UPDATE OF contract_id ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION populate_po_request_id();

-- Block direct caller-supplied updates to request_id unconditionally.
-- Propagation routes through trg_propagate_sc_request_id which touches contract_id
-- (SET contract_id = contract_id), firing trg_populate_po_request_id instead — so
-- this trigger is never in the propagation path and needs no bypass.
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
--   * Reassignment / clearing (non-NULL → anything else): reject.

CREATE OR REPLACE FUNCTION sync_sc_request_id()
RETURNS trigger LANGUAGE plpgsql
  SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF OLD.maintenance_request_id IS NOT NULL
     AND NEW.maintenance_request_id IS DISTINCT FROM OLD.maintenance_request_id THEN
    RAISE EXCEPTION
      'service_contracts.maintenance_request_id is immutable once set; old=%, attempted=%',
      OLD.maintenance_request_id, NEW.maintenance_request_id;
  END IF;
  RETURN NEW;
END $$;

-- SECURITY DEFINER: propagation must cover every linked PO regardless of the caller's
-- RLS context. Without this, POs owned by other roles would be filtered out, retaining
-- request_id = NULL and silently escaping the reclaim sweep.
CREATE OR REPLACE FUNCTION propagate_sc_request_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF OLD.maintenance_request_id IS NULL AND NEW.maintenance_request_id IS NOT NULL THEN
    -- Touch contract_id on each linked PO to re-trigger populate_po_request_id.
    -- Runs as the function definer (service_role / postgres), bypassing PO RLS so all
    -- linked POs are updated. populate_po_request_id fires as a BEFORE trigger within
    -- this elevated context and reads the now-committed maintenance_request_id.
    UPDATE public.purchase_orders
       SET contract_id = contract_id
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

