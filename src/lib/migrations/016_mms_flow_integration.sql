-- MMS Flow Integration: Connect maintenance_requests to quotes and vendor routing
-- This migration enhances the maintenance_requests table to support the full MMS workflow

-- 1. Add MMS-specific fields to maintenance_requests
ALTER TABLE public.maintenance_requests 
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS mms_status text DEFAULT 'notification' CHECK (mms_status IN ('notification', 'acknowledged', 'vendor_routed', 'quote_received', 'po_issued', 'in_progress', 'completed')),
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS vendor_routed_at timestamptz,
  ADD COLUMN IF NOT EXISTS quote_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS selected_vendor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selected_quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS po_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

-- 2. Create dedicated_vendors table for vendor routing
CREATE TABLE IF NOT EXISTS public.dedicated_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.service_categories(id) ON DELETE SET NULL,
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  priority smallint DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. Create maintenance_request_audit_logs for MMS flow tracking
CREATE TABLE IF NOT EXISTS public.maintenance_request_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  event text NOT NULL, -- notification_raised|acknowledged|vendor_routed|quote_received|quote_approved|po_issued|work_started|work_completed
  actor_id uuid REFERENCES public.profiles(id),
  data jsonb, -- additional event-specific data
  created_at timestamptz DEFAULT now()
);

-- 4. Create vendor_quote_requests for tracking which vendors were asked to quote
CREATE TABLE IF NOT EXISTS public.vendor_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'declined', 'expired')),
  response_deadline timestamptz NOT NULL,
  responded_at timestamptz,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_owner ON public.maintenance_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_mms_status ON public.maintenance_requests(mms_status);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_vendor ON public.maintenance_requests(selected_vendor_id);
CREATE INDEX IF NOT EXISTS idx_dedicated_vendors_property ON public.dedicated_vendors(property_id, is_active);
CREATE INDEX IF NOT EXISTS idx_dedicated_vendors_category ON public.dedicated_vendors(category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_maintenance_audit_request ON public.maintenance_request_audit_logs(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_quote_requests_request ON public.vendor_quote_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_vendor_quote_requests_vendor ON public.vendor_quote_requests(vendor_id, status);

-- RLS Policies
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dedicated_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_request_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_quote_requests ENABLE ROW LEVEL SECURITY;

-- Maintenance requests: owner can read/write their requests, tenant can read/write their requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='maintenance_requests' AND policyname='maintenance_requests_owner_access'
  ) THEN
    CREATE POLICY "maintenance_requests_owner_access" ON public.maintenance_requests
      FOR ALL TO authenticated
      USING (owner_id = (select auth.uid()))
      WITH CHECK (owner_id = (select auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='maintenance_requests' AND policyname='maintenance_requests_tenant_access'
  ) THEN
    CREATE POLICY "maintenance_requests_tenant_access" ON public.maintenance_requests
      FOR ALL TO authenticated
      USING (tenant_id = (select auth.uid()))
      WITH CHECK (tenant_id = (select auth.uid()));
  END IF;
END $$;

-- Vendors can read requests they're assigned to or asked to quote on
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='maintenance_requests' AND policyname='maintenance_requests_vendor_access'
  ) THEN
    CREATE POLICY "maintenance_requests_vendor_access" ON public.maintenance_requests
      FOR SELECT TO authenticated
      USING (
        selected_vendor_id = (select auth.uid()) OR
        EXISTS (
          SELECT 1 FROM public.vendor_quote_requests vqr 
          WHERE vqr.request_id = maintenance_requests.id 
            AND vqr.vendor_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- Dedicated vendors: property owners can manage their vendor assignments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dedicated_vendors' AND policyname='dedicated_vendors_owner_access'
  ) THEN
    CREATE POLICY "dedicated_vendors_owner_access" ON public.dedicated_vendors
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.properties p 
          WHERE p.id = dedicated_vendors.property_id 
            AND p.owner_id = (select auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.properties p 
          WHERE p.id = dedicated_vendors.property_id 
            AND p.owner_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- Vendors can read their own assignments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dedicated_vendors' AND policyname='dedicated_vendors_vendor_read'
  ) THEN
    CREATE POLICY "dedicated_vendors_vendor_read" ON public.dedicated_vendors
      FOR SELECT TO authenticated
      USING (vendor_id = (select auth.uid()));
  END IF;
END $$;

-- Audit logs: parties to the maintenance request can read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='maintenance_request_audit_logs' AND policyname='maintenance_audit_party_read'
  ) THEN
    CREATE POLICY "maintenance_audit_party_read" ON public.maintenance_request_audit_logs
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.maintenance_requests mr 
          WHERE mr.id = maintenance_request_audit_logs.request_id 
            AND (
              mr.owner_id = (select auth.uid()) 
              OR mr.tenant_id = (select auth.uid())
              OR mr.selected_vendor_id = (select auth.uid())
            )
        )
      );
  END IF;
END $$;

-- Vendor quote requests: vendors can read/update their own requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_quote_requests' AND policyname='vendor_quote_requests_vendor_access'
  ) THEN
    CREATE POLICY "vendor_quote_requests_vendor_access" ON public.vendor_quote_requests
      FOR ALL TO authenticated
      USING (vendor_id = (select auth.uid()))
      WITH CHECK (vendor_id = (select auth.uid()));
  END IF;
END $$;

-- Owners can read quote requests for their maintenance requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_quote_requests' AND policyname='vendor_quote_requests_owner_read'
  ) THEN
    CREATE POLICY "vendor_quote_requests_owner_read" ON public.vendor_quote_requests
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.maintenance_requests mr 
          WHERE mr.id = vendor_quote_requests.request_id 
            AND mr.owner_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- RPC Functions for MMS workflow

-- Function to route maintenance request to vendors
CREATE OR REPLACE FUNCTION public.route_maintenance_request_to_vendors(
  request_id uuid,
  quote_deadline_hours integer DEFAULT 24
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_id uuid;
  v_quote_deadline timestamptz;
BEGIN
  -- Get property and set deadline
  SELECT property_id, now() + (quote_deadline_hours || ' hours')::interval 
  INTO v_property_id, v_quote_deadline
  FROM public.maintenance_requests 
  WHERE id = request_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Maintenance request not found';
  END IF;
  
  -- Insert quote requests for all dedicated vendors for this property
  INSERT INTO public.vendor_quote_requests (request_id, vendor_id, response_deadline)
  SELECT request_id, vendor_id, v_quote_deadline
  FROM public.dedicated_vendors
  WHERE property_id = v_property_id 
    AND is_active = true;
  
  -- Update maintenance request status
  UPDATE public.maintenance_requests 
  SET mms_status = 'vendor_routed', 
      vendor_routed_at = now(),
      quote_deadline = v_quote_deadline
  WHERE id = request_id;
  
  -- Log the event
  INSERT INTO public.maintenance_request_audit_logs (request_id, event, actor_id, data)
  VALUES (request_id, 'vendor_routed', (SELECT auth.uid()), 
          jsonb_build_object('quote_deadline', v_quote_deadline, 'vendors_contacted', 
            (SELECT count(*) FROM public.vendor_quote_requests WHERE request_id = route_maintenance_request_to_vendors.request_id)));
END;
$$;

-- Function to approve quote and generate PO
CREATE OR REPLACE FUNCTION public.approve_quote_and_generate_po(
  quote_id uuid
)
RETURNS uuid -- returns the PO ID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote record;
  v_po_id uuid;
  v_po_number text;
BEGIN
  -- Get quote details
  SELECT q.*, mr.id as request_id, mr.property_id
  INTO v_quote
  FROM public.quotes q
  JOIN public.maintenance_requests mr ON mr.id = q.request_id
  WHERE q.id = quote_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;
  
  -- Generate PO number
  v_po_number := 'PO-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('po_sequence')::text, 4, '0');
  
  -- Create PO
  INSERT INTO public.purchase_orders (contract_id, po_number, subtotal, total_amount, status)
  VALUES (v_quote.contract_id, v_po_number, v_quote.subtotal, v_quote.total_amount, 'po_issued')
  RETURNING id INTO v_po_id;
  
  -- Update maintenance request
  UPDATE public.maintenance_requests 
  SET mms_status = 'po_issued',
      selected_vendor_id = v_quote.vendor_id,
      selected_quote_id = quote_id,
      po_id = v_po_id
  WHERE id = v_quote.request_id;
  
  -- Update quote status
  UPDATE public.quotes 
  SET status = 'approved'
  WHERE id = quote_id;
  
  -- Log the event
  INSERT INTO public.maintenance_request_audit_logs (request_id, event, actor_id, data)
  VALUES (v_quote.request_id, 'quote_approved', (SELECT auth.uid()), 
          jsonb_build_object('quote_id', quote_id, 'po_id', v_po_id, 'po_number', v_po_number));
  
  RETURN v_po_id;
END;
$$;

-- Create sequence for PO numbers if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS public.po_sequence START 1;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.route_maintenance_request_to_vendors(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_quote_and_generate_po(uuid) TO authenticated;
