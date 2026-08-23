-- MIGRATION 067: Vendor directory + invite RLS (Plane #106)
--
-- Owners and tenants could not browse the marketplace: vendor_services and
-- vendor_service_areas were vendor-self only (SELECT empty). Inviting a
-- vendor onto a job also failed: vendor_quote_requests INSERT required
-- vendor_id = auth.uid().

DROP POLICY IF EXISTS vendor_services_directory_read ON vendor_services;
CREATE POLICY vendor_services_directory_read ON vendor_services
  FOR SELECT
  TO authenticated
  USING (COALESCE(is_active, true) = true);

DROP POLICY IF EXISTS vendor_service_areas_directory_read ON vendor_service_areas;
CREATE POLICY vendor_service_areas_directory_read ON vendor_service_areas
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS vendor_quote_requests_job_party_insert ON vendor_quote_requests;
CREATE POLICY vendor_quote_requests_job_party_insert ON vendor_quote_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM maintenance_requests mr
      WHERE mr.id = request_id
        AND (mr.owner_id = auth.uid() OR mr.tenant_id = auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = vendor_id
        AND p.role = 'vendor'
    )
  );

DROP POLICY IF EXISTS vendor_quote_requests_job_party_select ON vendor_quote_requests;
CREATE POLICY vendor_quote_requests_job_party_select ON vendor_quote_requests
  FOR SELECT
  TO authenticated
  USING (
    vendor_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM maintenance_requests mr
      WHERE mr.id = request_id
        AND (mr.owner_id = auth.uid() OR mr.tenant_id = auth.uid())
    )
  );

COMMENT ON POLICY vendor_services_directory_read ON vendor_services IS
  'Authenticated users can list active vendor trades for the directory (Plane #106).';
COMMENT ON POLICY vendor_service_areas_directory_read ON vendor_service_areas IS
  'Authenticated users can list vendor service areas for the directory (Plane #106).';
COMMENT ON POLICY vendor_quote_requests_job_party_insert ON vendor_quote_requests IS
  'Owner or tenant on the job may invite only users with role=vendor (Plane #106).';
COMMENT ON POLICY vendor_quote_requests_job_party_select ON vendor_quote_requests IS
  'Job parties and the invited vendor can read quote-request rows (Plane #106).';
