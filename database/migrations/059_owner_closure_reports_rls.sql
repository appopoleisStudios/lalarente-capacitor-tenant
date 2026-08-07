-- ============================================================
-- MIGRATION 059: Add OWNER RLS policies on closure_reports
-- ============================================================
-- Real production bug found by the Plane #77 Maestro ship gate:
-- closure_reports had tenant policies (018) and vendor policies
-- (047/050) but NO owner policies at all. The owner token was
-- RLS-filtered to zero rows, so:
--
--   1. getClosureReport() returned null for owners → the owner
--      maintenance detail never rendered "Review Closure Report".
--   2. approveClosureReport() / rejectClosureReport() /
--      forwardClosureToTenant() UPDATEs were silently filtered
--      (0 rows matched) → owner approve/reject/forward never
--      persisted.
--
-- This mirrors the tenant policy pattern from migration 018
-- (maintenance_requests.owner_id = auth.uid()).
-- ============================================================

DROP POLICY IF EXISTS "Owners can view their closure reports" ON closure_reports;

-- Owners can view closure reports for their maintenance requests
CREATE POLICY "Owners can view their closure reports"
ON closure_reports FOR SELECT
TO authenticated
USING (
  maintenance_request_id IN (
    SELECT id FROM maintenance_requests WHERE owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can update their closure reports" ON closure_reports;

-- Owners can update closure reports for their maintenance requests
-- (approve/reject closure, forward to tenant for verification)
CREATE POLICY "Owners can update their closure reports"
ON closure_reports FOR UPDATE
TO authenticated
USING (
  maintenance_request_id IN (
    SELECT id FROM maintenance_requests WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  maintenance_request_id IN (
    SELECT id FROM maintenance_requests WHERE owner_id = auth.uid()
  )
);

COMMENT ON POLICY "Owners can view their closure reports" ON closure_reports IS
  'Owners can read closure reports for their maintenance requests (owner_id).';

COMMENT ON POLICY "Owners can update their closure reports" ON closure_reports IS
  'Owners can approve/reject closure reports and forward them to the tenant for
   verification on their maintenance requests (owner_id).';
