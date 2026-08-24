-- Break RLS recursion: maintenance_requests vendor SELECT ↔ vendor_quote_requests
-- job-party SELECT. Owner dashboard getMaintenanceRequests() returned 42P17 and
-- blanked the whole owner home (Maestro owner-vendor-directory).

CREATE OR REPLACE FUNCTION is_maintenance_job_party(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM maintenance_requests mr
    WHERE mr.id = p_request_id
      AND (mr.owner_id = auth.uid() OR mr.tenant_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION vendor_invited_to_request(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM vendor_quote_requests vqr
    WHERE vqr.request_id = p_request_id
      AND vqr.vendor_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION is_maintenance_job_party(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION vendor_invited_to_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_maintenance_job_party(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION vendor_invited_to_request(uuid) TO authenticated;

DROP POLICY IF EXISTS maintenance_requests_vendor_select ON maintenance_requests;
CREATE POLICY maintenance_requests_vendor_select ON maintenance_requests
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    OR selected_vendor_id = auth.uid()
    OR vendor_invited_to_request(id)
  );

DROP POLICY IF EXISTS vendor_quote_requests_job_party_select ON vendor_quote_requests;
CREATE POLICY vendor_quote_requests_job_party_select ON vendor_quote_requests
  FOR SELECT
  TO authenticated
  USING (
    vendor_id = auth.uid()
    OR is_maintenance_job_party(request_id)
  );

DROP POLICY IF EXISTS vendor_quote_requests_job_party_insert ON vendor_quote_requests;
CREATE POLICY vendor_quote_requests_job_party_insert ON vendor_quote_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_maintenance_job_party(request_id)
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = vendor_id AND p.role = 'vendor'
    )
  );
