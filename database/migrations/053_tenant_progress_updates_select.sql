-- ============================================================
-- MIGRATION 053: Tenant SELECT policy on job_progress_updates
-- ============================================================
-- CAUGHT BY MAESTRO E2E (flow 21-pr16-tenant-closure-confirm.yaml):
-- the tenant timeline photo (Plane #61 / PR #115) never rendered for
-- tenants. Live RLS inspection showed job_progress_updates has:
--   - "Vendors can manage their progress updates" (ALL, vendor_id)
--   - "Owners can view progress updates"        (SELECT, owner)
--   - NO tenant SELECT policy
-- The tenant's getProgressUpdates() (TenantMaintenanceDetailScreen)
-- therefore returned ZERO rows — the Progress Updates card (and its
-- latest-photo surface, #115) silently never appeared for tenants.
-- Unit tests cannot catch RLS gaps; only a live E2E run can.
--
-- Fix: mirror the established tenant-access predicate used by
-- maintenance_requests (tenant_id = auth.uid()).
-- ============================================================

DROP POLICY IF EXISTS "Tenants can view progress updates" ON job_progress_updates;

CREATE POLICY "Tenants can view progress updates"
ON job_progress_updates FOR SELECT
TO authenticated
USING (
  maintenance_request_id IN (
    SELECT id FROM maintenance_requests WHERE tenant_id = auth.uid()
  )
);

COMMENT ON POLICY "Tenants can view progress updates" ON job_progress_updates IS
  'Tenants can view progress updates for their own maintenance requests
   (Plane #61 tenant timeline). Added after the Maestro E2E run surfaced a
   silent zero-row read for tenants (migration 053).';
