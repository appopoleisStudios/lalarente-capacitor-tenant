-- Behavioral tests for migration 080: dispatch authority fixes
-- Requires: pgTAP extension, supabase_test helpers
--
-- Run via:
--   psql $DATABASE_URL -f database/tests/080_dispatch_authority_tests.sql
--
-- Covers:
--   A. Trigger: fail-safe flag on unlinked insert
--   B. Trigger: flag + status derived from service item
--   C. Trigger: cross-property service_item_id rejected
--   D. Unique index: duplicate active item rejected; soft-deleted allowed
--   E. mva_insert: tenant blocked after reclaim (status no longer tenant_dispatching)
--   F. reclaim_request: FOR UPDATE prevents concurrent assignment race
--   G. release_to_tenant_dispatch: idempotent conditional UPDATE

BEGIN;

SELECT plan(24);

-- ─── Fixtures ────────────────────────────────────────────────────────────────

SELECT tests.create_supabase_user('owner_a', 'owner_a@test.local');
SELECT tests.create_supabase_user('tenant_a', 'tenant_a@test.local');
SELECT tests.create_supabase_user('tenant_b', 'tenant_b@test.local');

DO $$
DECLARE
  v_owner_id  uuid := tests.get_supabase_uid('owner_a');
  v_tenant_id uuid := tests.get_supabase_uid('tenant_a');
  v_prop_id   uuid := gen_random_uuid();
  v_psi_id    uuid := gen_random_uuid();
BEGIN
  INSERT INTO properties (id, title, address, city, owner_id, status)
  VALUES (v_prop_id, '_test_prop_080', '_addr', '_city', v_owner_id, 'active');

  INSERT INTO property_service_items (id, property_id, name, tenant_may_dispatch)
  VALUES (v_psi_id, v_prop_id, 'plumbing', false);

  INSERT INTO leases (property_id, owner_id, tenant_id, status, start_date, end_date,
                      monthly_rent, deposit_amount, lease_type)
  VALUES (v_prop_id, v_owner_id, v_tenant_id, 'active',
          now(), now() + interval '1 year', 10000, 10000, 'fixed_term');

  -- Store for later reference by test SQL
  PERFORM set_config('test.prop_id',  v_prop_id::text, true);
  PERFORM set_config('test.psi_id',   v_psi_id::text, true);
  PERFORM set_config('test.owner_id', v_owner_id::text, true);
  PERFORM set_config('test.tenant_id', v_tenant_id::text, true);
END $$;

-- ─── A. Fail-safe flag on unlinked insert ────────────────────────────────────

SELECT tests.authenticate_as('tenant_a');

SELECT is(
  (INSERT INTO maintenance_requests (
     property_id, owner_id, tenant_id, title, description,
     priority, status, captured_tenant_may_dispatch
   ) VALUES (
     current_setting('test.prop_id')::uuid,
     current_setting('test.owner_id')::uuid,
     current_setting('test.tenant_id')::uuid,
     'A_unlinked', 'desc', 'low', 'open',
     true  -- forged
   ) RETURNING captured_tenant_may_dispatch),
  false,
  'A1: trigger must override forged captured_tenant_may_dispatch to false'
);

SELECT tests.clear_authentication();

-- ─── B. Flag + status derived from service item ──────────────────────────────

SELECT tests.authenticate_as('tenant_a');

-- tenant_may_dispatch = false → awaiting_owner_dispatch
SELECT row_eq(
  $q$
    INSERT INTO maintenance_requests (
      property_id, owner_id, tenant_id, title, description,
      priority, status, service_item_id
    ) VALUES (
      current_setting('test.prop_id')::uuid,
      current_setting('test.owner_id')::uuid,
      current_setting('test.tenant_id')::uuid,
      'B_linked_false', 'desc', 'low', 'open',
      current_setting('test.psi_id')::uuid
    ) RETURNING captured_tenant_may_dispatch, status::text
  $q$,
  ROW(false, 'awaiting_owner_dispatch'),
  'B1: tenant_may_dispatch=false → awaiting_owner_dispatch'
);

-- Flip tenant_may_dispatch to true
UPDATE property_service_items
   SET tenant_may_dispatch = true
 WHERE id = current_setting('test.psi_id')::uuid;

SELECT row_eq(
  $q$
    INSERT INTO maintenance_requests (
      property_id, owner_id, tenant_id, title, description,
      priority, status, service_item_id
    ) VALUES (
      current_setting('test.prop_id')::uuid,
      current_setting('test.owner_id')::uuid,
      current_setting('test.tenant_id')::uuid,
      'B_linked_true', 'desc', 'low', 'open',
      current_setting('test.psi_id')::uuid
    ) RETURNING captured_tenant_may_dispatch, status::text
  $q$,
  ROW(true, 'tenant_dispatching'),
  'B2: tenant_may_dispatch=true → tenant_dispatching'
);

SELECT tests.clear_authentication();

-- ─── C. Cross-property service_item_id rejected ──────────────────────────────

SELECT tests.authenticate_as('tenant_a');

SELECT throws_like(
  $q$
    INSERT INTO maintenance_requests (
      property_id, owner_id, tenant_id, title, description,
      priority, status, service_item_id
    ) VALUES (
      gen_random_uuid(),  -- different property
      current_setting('test.owner_id')::uuid,
      current_setting('test.tenant_id')::uuid,
      'C_cross', 'desc', 'low', 'open',
      current_setting('test.psi_id')::uuid
    )
  $q$,
  '%does not belong to property_id%',
  'C1: cross-property service_item_id raises exception'
);

SELECT tests.clear_authentication();

-- ─── D. Unique index ─────────────────────────────────────────────────────────

SELECT tests.authenticate_as('owner_a');

-- Soft-deleted row does not block re-insertion
INSERT INTO property_service_items (property_id, name, tenant_may_dispatch, deleted_at)
VALUES (current_setting('test.prop_id')::uuid, 'D_item', true, now());

SELECT lives_ok(
  $q$
    INSERT INTO property_service_items (property_id, name, tenant_may_dispatch)
    VALUES (current_setting('test.prop_id')::uuid, 'D_item', true)
  $q$,
  'D1: re-inserting a soft-deleted service item is allowed'
);

SELECT throws_ok(
  $q$
    INSERT INTO property_service_items (property_id, name, tenant_may_dispatch)
    VALUES (current_setting('test.prop_id')::uuid, 'D_item', true)
  $q$,
  '23505',
  NULL,
  'D2: second active insert for same name is rejected'
);

SELECT tests.clear_authentication();

-- ─── E. Tenant blocked from inserting assignment after reclaim ───────────────

-- Get a request in tenant_dispatching state then reclaim it
DO $$
DECLARE
  v_req_id uuid;
BEGIN
  SELECT id INTO v_req_id
    FROM maintenance_requests
   WHERE title = 'B_linked_true' LIMIT 1;
  PERFORM set_config('test.td_req_id', v_req_id::text, true);
END $$;

SELECT tests.authenticate_as('owner_a');

SELECT lives_ok(
  $q$ SELECT reclaim_request(current_setting('test.td_req_id')::uuid, 'test reclaim') $q$,
  'E0: owner can reclaim tenant_dispatching request'
);

SELECT tests.authenticate_as('tenant_a');

SELECT throws_like(
  $q$
    INSERT INTO maintenance_vendor_assignments (request_id, vendor_id)
    VALUES (
      current_setting('test.td_req_id')::uuid,
      current_setting('test.tenant_id')::uuid
    )
  $q$,
  '%not in tenant_dispatching state%',
  'E1: tenant cannot assign vendor after request is reclaimed'
);

SELECT tests.clear_authentication();

-- ─── F. release_to_tenant_dispatch: rejected when not awaiting ───────────────

SELECT tests.authenticate_as('owner_a');

-- Get a request in awaiting_owner_dispatch state
DO $$
DECLARE
  v_req_id uuid;
BEGIN
  SELECT id INTO v_req_id
    FROM maintenance_requests
   WHERE title = 'B_linked_false' LIMIT 1;
  PERFORM set_config('test.aod_req_id', v_req_id::text, true);
END $$;

SELECT lives_ok(
  $q$ SELECT release_to_tenant_dispatch(current_setting('test.aod_req_id')::uuid) $q$,
  'F1: owner can release awaiting_owner_dispatch request'
);

-- Calling again should fail (request is now tenant_dispatching)
SELECT throws_like(
  $q$ SELECT release_to_tenant_dispatch(current_setting('test.aod_req_id')::uuid) $q$,
  '%not awaiting dispatch%',
  'F2: release is idempotent-safe (second call rejected)'
);

SELECT tests.clear_authentication();

-- ─── G. captured_tenant_may_dispatch reset to false after reclaim ────────────

SELECT tests.authenticate_as('owner_a');

SELECT is(
  (SELECT captured_tenant_may_dispatch
     FROM maintenance_requests
    WHERE id = current_setting('test.td_req_id')::uuid),
  false,
  'G1: reclaim_request resets captured_tenant_may_dispatch to false'
);

SELECT tests.clear_authentication();

-- ─── H. Reclaim succeeds with zero open assignments/POs ─────────────────────

-- Use the aod_req_id request (now in tenant_dispatching state after F1)
-- It has no assignments and no POs → reclaim should succeed

SELECT tests.authenticate_as('owner_a');

SELECT lives_ok(
  $q$ SELECT reclaim_request(current_setting('test.aod_req_id')::uuid, 'H reclaim') $q$,
  'H1: reclaim succeeds when no open assignments or POs exist'
);

SELECT is(
  (SELECT status::text FROM maintenance_requests
    WHERE id = current_setting('test.aod_req_id')::uuid),
  'awaiting_owner_dispatch',
  'H2: request status reset to awaiting_owner_dispatch after reclaim'
);

SELECT tests.clear_authentication();

-- ─── I. Reclaim blocked when active assignment exists ─────────────────────────

DO $$
DECLARE
  v_req_id  uuid;
  v_vnd_id  uuid;
BEGIN
  -- Create a fresh tenant_dispatching request
  UPDATE property_service_items
     SET tenant_may_dispatch = true
   WHERE id = current_setting('test.psi_id')::uuid;

  INSERT INTO maintenance_requests (
    property_id, owner_id, tenant_id, title, description,
    priority, status, service_item_id
  ) VALUES (
    current_setting('test.prop_id')::uuid,
    current_setting('test.owner_id')::uuid,
    current_setting('test.tenant_id')::uuid,
    'I_active_assign', 'desc', 'low', 'tenant_dispatching',
    current_setting('test.psi_id')::uuid
  ) RETURNING id INTO v_req_id;

  PERFORM set_config('test.i_req_id', v_req_id::text, true);

  -- Insert an active assignment directly (bypass trigger for test setup)
  v_vnd_id := gen_random_uuid();
  INSERT INTO maintenance_vendor_assignments (request_id, vendor_id, status)
  VALUES (v_req_id, v_vnd_id, 'pending');
END $$;

SELECT tests.authenticate_as('owner_a');

SELECT throws_like(
  $q$ SELECT reclaim_request(current_setting('test.i_req_id')::uuid, 'I reclaim') $q$,
  '%reclaim aborted%',
  'I1: reclaim blocked when an active assignment exists'
);

SELECT tests.clear_authentication();

-- ─── J. Reclaim blocked when active PO exists ────────────────────────────────

DO $$
DECLARE
  v_req_id uuid;
BEGIN
  -- Create a fresh tenant_dispatching request
  INSERT INTO maintenance_requests (
    property_id, owner_id, tenant_id, title, description,
    priority, status, service_item_id
  ) VALUES (
    current_setting('test.prop_id')::uuid,
    current_setting('test.owner_id')::uuid,
    current_setting('test.tenant_id')::uuid,
    'J_active_po', 'desc', 'low', 'tenant_dispatching',
    current_setting('test.psi_id')::uuid
  ) RETURNING id INTO v_req_id;

  PERFORM set_config('test.j_req_id', v_req_id::text, true);

  -- Insert an active PO directly
  INSERT INTO purchase_orders (request_id, property_id, owner_id, vendor_id, status, amount)
  VALUES (
    v_req_id,
    current_setting('test.prop_id')::uuid,
    current_setting('test.owner_id')::uuid,
    gen_random_uuid(),
    'pending',
    500
  );
END $$;

SELECT tests.authenticate_as('owner_a');

SELECT throws_like(
  $q$ SELECT reclaim_request(current_setting('test.j_req_id')::uuid, 'J reclaim') $q$,
  '%reclaim aborted%',
  'J1: reclaim blocked when an active PO exists'
);

SELECT tests.clear_authentication();

-- ─── K. Reclaim blocked when vendor_id set but no assignment row exists ────────

DO $$
DECLARE
  v_req_id  uuid;
  v_vnd_id  uuid := gen_random_uuid();
BEGIN
  -- Insert a tenant_dispatching request with vendor_id set directly
  -- but intentionally no corresponding assignment row.
  INSERT INTO maintenance_requests (
    property_id, owner_id, tenant_id, title, description,
    priority, status, service_item_id, vendor_id
  ) VALUES (
    current_setting('test.prop_id')::uuid,
    current_setting('test.owner_id')::uuid,
    current_setting('test.tenant_id')::uuid,
    'K_no_assignment', 'desc', 'low', 'tenant_dispatching',
    current_setting('test.psi_id')::uuid,
    v_vnd_id
  ) RETURNING id INTO v_req_id;

  PERFORM set_config('test.k_req_id', v_req_id::text, true);
END $$;

SELECT tests.authenticate_as('owner_a');

SELECT throws_like(
  $q$ SELECT reclaim_request(current_setting('test.k_req_id')::uuid, 'K reclaim') $q$,
  '%reclaim aborted: request.vendor_id is set but has no active assignment row%',
  'K1: reclaim blocked when vendor_id set without a corresponding assignment row'
);

SELECT tests.clear_authentication();

-- ─── L. Cancel-then-reclaim succeeds — vendor_id cleared by cancel_assignment ─
-- Verifies that cancel_assignment() clears maintenance_requests.vendor_id so
-- reclaim_request() can proceed without tripping the orphan-vendor_id guard.

DO $$
DECLARE
  v_req_id  uuid;
  v_vnd_id  uuid := tests.get_supabase_uid('tenant_b');
  v_asgn_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO maintenance_requests (
    property_id, owner_id, tenant_id, title, description,
    priority, status, service_item_id, vendor_id
  ) VALUES (
    current_setting('test.prop_id')::uuid,
    current_setting('test.owner_id')::uuid,
    current_setting('test.tenant_id')::uuid,
    'L_cancel_reclaim', 'desc', 'low', 'tenant_dispatching',
    current_setting('test.psi_id')::uuid,
    v_vnd_id
  ) RETURNING id INTO v_req_id;

  INSERT INTO maintenance_vendor_assignments (id, request_id, vendor_id, status)
  VALUES (v_asgn_id, v_req_id, v_vnd_id, 'pending');

  PERFORM set_config('test.l_req_id',  v_req_id::text,  true);
  PERFORM set_config('test.l_asgn_id', v_asgn_id::text, true);
END $$;

SELECT tests.authenticate_as('owner_a');

SELECT lives_ok(
  $q$ SELECT cancel_assignment(current_setting('test.l_asgn_id')::uuid) $q$,
  'L1: cancel_assignment succeeds for owner'
);

SELECT is(
  (SELECT vendor_id FROM maintenance_requests WHERE id = current_setting('test.l_req_id')::uuid),
  NULL,
  'L2: cancel_assignment clears maintenance_requests.vendor_id'
);

SELECT lives_ok(
  $q$ SELECT reclaim_request(current_setting('test.l_req_id')::uuid, 'L reclaim') $q$,
  'L3: reclaim_request succeeds after cancel_assignment clears vendor_id'
);

SELECT tests.clear_authentication();

-- ─── M. populate_po_request_id trigger consistency ───────────────────────────
-- M1: conflicting explicit request_id is rejected
-- M2: contract_id UPDATE propagates the request_id
-- M3: PO with NULL contract_id is left untouched

DO $$
DECLARE
  v_contract_id  uuid := gen_random_uuid();
  v_req_id       uuid := gen_random_uuid();
  v_other_req_id uuid := gen_random_uuid();
  v_po_id        uuid := gen_random_uuid();
BEGIN
  INSERT INTO maintenance_requests (id, property_id, owner_id, tenant_id, title, description,
    priority, status, service_item_id)
  VALUES (v_req_id, current_setting('test.prop_id')::uuid,
    current_setting('test.owner_id')::uuid, current_setting('test.tenant_id')::uuid,
    'M_req', 'desc', 'low', 'pending', current_setting('test.psi_id')::uuid);

  INSERT INTO service_contracts (id, maintenance_request_id, vendor_id, status)
  VALUES (v_contract_id, v_req_id,
    tests.get_supabase_uid('tenant_b'), 'active');

  PERFORM set_config('test.m_contract_id',  v_contract_id::text,  true);
  PERFORM set_config('test.m_req_id',       v_req_id::text,       true);
  PERFORM set_config('test.m_other_req_id', v_other_req_id::text, true);
  PERFORM set_config('test.m_po_id',        v_po_id::text,        true);
END $$;

SELECT throws_like(
  $q$
    INSERT INTO purchase_orders (
      id, contract_id, request_id, po_number, currency,
      subtotal, vat_amount, platform_fee_amount, total_amount, status, revision_number
    ) VALUES (
      gen_random_uuid(),
      current_setting('test.m_contract_id')::uuid,
      current_setting('test.m_other_req_id')::uuid,
      'PO-M1', 'ZAR', 1000, 150, 50, 1200, 'issued', 1
    )
  $q$,
  '%conflicts with contract chain%',
  'M1: conflicting explicit request_id is rejected by trigger'
);

DO $$
DECLARE
  v_po_id uuid := current_setting('test.m_po_id')::uuid;
BEGIN
  INSERT INTO purchase_orders (
    id, contract_id, po_number, currency,
    subtotal, vat_amount, platform_fee_amount, total_amount, status, revision_number
  ) VALUES (
    v_po_id, NULL, 'PO-M2', 'ZAR', 1000, 150, 50, 1200, 'issued', 1
  );
END $$;

SELECT is(
  (SELECT request_id FROM purchase_orders WHERE id = current_setting('test.m_po_id')::uuid),
  NULL,
  'M3: PO with NULL contract_id has NULL request_id'
);

UPDATE purchase_orders
   SET contract_id = current_setting('test.m_contract_id')::uuid
 WHERE id = current_setting('test.m_po_id')::uuid;

SELECT is(
  (SELECT request_id FROM purchase_orders WHERE id = current_setting('test.m_po_id')::uuid),
  current_setting('test.m_req_id')::uuid,
  'M2: contract_id UPDATE propagates request_id from contract chain'
);

SELECT * FROM finish();
ROLLBACK;
