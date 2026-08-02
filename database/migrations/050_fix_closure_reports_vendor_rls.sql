-- ============================================================
-- MIGRATION 050: Fix closure_reports vendor RLS column alignment
-- ============================================================
-- SA review (PR #113 / Plane #58): the app checks
--   maintenance_requests.selected_vendor_id
-- but migration 047's "Vendors can update their closure reports"
-- policy filtered on maintenance_requests.vendor_id. If vendor_id
-- was null or a different party, the PostgREST UPDATE was RLS-
-- filtered to zero rows — silent closure breakage for the
-- Tenant->Vendor flow.
--
-- Fix: accept either column (selected_vendor_id is set by the
-- MMS quote-select flow; vendor_id is the dedicated-vendor
-- column). Also add vendor INSERT + SELECT policies so the
-- create path (no row yet) and vendor reads work, plus a unique
-- index on maintenance_request_id so create-or-update cannot
-- race-duplicate.
-- ============================================================

-- ------------------------------------------------------------------
-- 1. Fix the vendor UPDATE policy (from migration 047) to accept
--    selected_vendor_id OR vendor_id
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendors can update their closure reports" ON closure_reports;

CREATE POLICY "Vendors can update their closure reports"
ON closure_reports FOR UPDATE
TO authenticated
USING (
  maintenance_request_id IN (
    SELECT id FROM maintenance_requests
    WHERE selected_vendor_id = auth.uid() OR vendor_id = auth.uid()
  )
)
WITH CHECK (
  maintenance_request_id IN (
    SELECT id FROM maintenance_requests
    WHERE selected_vendor_id = auth.uid() OR vendor_id = auth.uid()
  )
);

-- ------------------------------------------------------------------
-- 2. Add vendor INSERT policy — required for the create path when
--    no closure_reports row exists yet (vendorRequestClosureWithPhotos)
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendors can insert their closure reports" ON closure_reports;

CREATE POLICY "Vendors can insert their closure reports"
ON closure_reports FOR INSERT
TO authenticated
WITH CHECK (
  maintenance_request_id IN (
    SELECT id FROM maintenance_requests
    WHERE selected_vendor_id = auth.uid() OR vendor_id = auth.uid()
  )
);

-- ------------------------------------------------------------------
-- 3. Add vendor SELECT policy — vendors must read their own closure
--    reports (getClosureReport / status checks)
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendors can view their closure reports" ON closure_reports;

CREATE POLICY "Vendors can view their closure reports"
ON closure_reports FOR SELECT
TO authenticated
USING (
  maintenance_request_id IN (
    SELECT id FROM maintenance_requests
    WHERE selected_vendor_id = auth.uid() OR vendor_id = auth.uid()
  )
);

-- ------------------------------------------------------------------
-- 4. Partial unique index on maintenance_request_id — at most ONE
--    ACTIVE closure report per request. Makes create-or-update safe
--    against race duplicates and matches the app's
--    getClosureReport().maybeSingle() assumption.
--
--    Partial (WHERE status <> 'rejected') so the LEGACY resubmit flow
--    still works: rejectClosureReport / tenantRejectCompletion leave the
--    old row with status='rejected', and the vendor's next requestClosure
--    inserts a fresh row — a full UNIQUE index would reject that insert.
--    (Idempotent: IF NOT EXISTS — safe on duplicate data, unlike a full
--    unique index which would fail at runtime if old duplicates exist.)
-- ------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_closure_reports_maintenance_request_active
  ON closure_reports (maintenance_request_id)
  WHERE status <> 'rejected';

COMMENT ON POLICY "Vendors can update their closure reports" ON closure_reports IS
  'Vendors can update closure reports for jobs where they are the
   selected vendor (selected_vendor_id) or the dedicated vendor
   (vendor_id). Aligned with app-layer checks per SA review.';
