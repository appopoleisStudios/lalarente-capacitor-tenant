-- MIGRATION 067b: Invite rows must target a vendor profile (SA review Plane #106)
--
-- 067 allowed job parties to INSERT vendor_quote_requests with any profiles.id.
-- Require role = vendor so tenants/owners cannot invite each other onto jobs.

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

COMMENT ON POLICY vendor_quote_requests_job_party_insert ON vendor_quote_requests IS
  'Owner or tenant on the job may invite only users with role=vendor (Plane #106 / 067b).';
