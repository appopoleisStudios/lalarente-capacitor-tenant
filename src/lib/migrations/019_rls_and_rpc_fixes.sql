-- RLS and RPC hardening for MMS (idempotent)
-- Captures manual fixes applied in prod so new envs match

-- 1) Route RPC: drop old signature, recreate with disambiguated params
DROP FUNCTION IF EXISTS public.route_maintenance_request_to_vendors(uuid, integer);

CREATE OR REPLACE FUNCTION public.route_maintenance_request_to_vendors(
  p_request_id uuid,
  p_quote_deadline_hours integer DEFAULT 24
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property_id uuid;
  v_quote_deadline timestamptz;
BEGIN
  -- fetch property and deadline
  SELECT mr.property_id, now() + (p_quote_deadline_hours || ' hours')::interval
  INTO v_property_id, v_quote_deadline
  FROM public.maintenance_requests mr
  WHERE mr.id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Maintenance request not found';
  END IF;

  -- create vendor quote requests for property's dedicated vendors
  INSERT INTO public.vendor_quote_requests (request_id, vendor_id, response_deadline)
  SELECT p_request_id, dv.vendor_id, v_quote_deadline
  FROM public.dedicated_vendors dv
  WHERE dv.property_id = v_property_id
    AND dv.is_active = true;

  -- update request status
  UPDATE public.maintenance_requests
  SET mms_status = 'vendor_routed',
      vendor_routed_at = now(),
      quote_deadline = v_quote_deadline
  WHERE id = p_request_id;

  -- audit log
  INSERT INTO public.maintenance_request_audit_logs (request_id, event, actor_id, data)
  VALUES (
    p_request_id,
    'vendor_routed',
    (SELECT auth.uid()),
    jsonb_build_object(
      'quote_deadline', v_quote_deadline,
      'vendors_contacted', (SELECT count(*) FROM public.vendor_quote_requests WHERE request_id = p_request_id)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.route_maintenance_request_to_vendors(uuid, integer) TO authenticated;

-- 2) RLS: replace recursive/ALL policies with explicit per-command rules
-- Drop possibly-present conflicting policies (safe if absent)
DROP POLICY IF EXISTS maintenance_requests_owner_access ON public.maintenance_requests;
DROP POLICY IF EXISTS maintenance_requests_tenant_access ON public.maintenance_requests;
DROP POLICY IF EXISTS maintenance_requests_vendor_access ON public.maintenance_requests;
DROP POLICY IF EXISTS maintenance_requests_vendor_select ON public.maintenance_requests;

-- Owners
DROP POLICY IF EXISTS maintenance_requests_owner_select ON public.maintenance_requests;
CREATE POLICY maintenance_requests_owner_select
ON public.maintenance_requests
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS maintenance_requests_owner_insert ON public.maintenance_requests;
CREATE POLICY maintenance_requests_owner_insert
ON public.maintenance_requests
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS maintenance_requests_owner_update ON public.maintenance_requests;
CREATE POLICY maintenance_requests_owner_update
ON public.maintenance_requests
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Tenants
DROP POLICY IF EXISTS maintenance_requests_tenant_select ON public.maintenance_requests;
CREATE POLICY maintenance_requests_tenant_select
ON public.maintenance_requests
FOR SELECT
TO authenticated
USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS maintenance_requests_tenant_insert ON public.maintenance_requests;
CREATE POLICY maintenance_requests_tenant_insert
ON public.maintenance_requests
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS maintenance_requests_tenant_update ON public.maintenance_requests;
CREATE POLICY maintenance_requests_tenant_update
ON public.maintenance_requests
FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid())
WITH CHECK (tenant_id = auth.uid());

-- Vendors read only, non-recursive
CREATE POLICY IF NOT EXISTS maintenance_requests_vendor_select
ON public.maintenance_requests
FOR SELECT
TO authenticated
USING (
  selected_vendor_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.vendor_quote_requests vqr
    WHERE vqr.request_id = maintenance_requests.id
      AND vqr.vendor_id = auth.uid()
  )
);

-- Vendor quote requests: vendors manage their own
DROP POLICY IF EXISTS vendor_quote_requests_vendor_access ON public.vendor_quote_requests;
CREATE POLICY vendor_quote_requests_vendor_access
ON public.vendor_quote_requests
FOR ALL
TO authenticated
USING (vendor_id = auth.uid())
WITH CHECK (vendor_id = auth.uid());

-- Remove owner read that caused recursion via maintenance_requests
DROP POLICY IF EXISTS vendor_quote_requests_owner_read ON public.vendor_quote_requests;

-- Audit logs insert by actor
CREATE POLICY IF NOT EXISTS maintenance_request_audit_owner_insert
ON public.maintenance_request_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (actor_id = auth.uid());



