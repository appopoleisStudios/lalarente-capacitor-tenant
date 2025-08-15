-- MMS Test Data: Seed service categories, dedicated vendors, and sample maintenance requests
-- This migration creates test data to demonstrate the MMS flow

-- 1. Seed service categories
INSERT INTO public.service_categories (id, name, description) VALUES
  (gen_random_uuid(), 'Plumbing', 'Plumbing repairs and maintenance'),
  (gen_random_uuid(), 'Electrical', 'Electrical repairs and installations'),
  (gen_random_uuid(), 'HVAC', 'Heating, ventilation, and air conditioning'),
  (gen_random_uuid(), 'Cleaning', 'General cleaning and maintenance'),
  (gen_random_uuid(), 'Security', 'Security system installation and maintenance')
ON CONFLICT (id) DO NOTHING;

-- 2. Create sample properties if they don't exist
DO $$
DECLARE
  v_owner_id uuid;
  v_prop1 uuid;
  v_prop2 uuid;
BEGIN
  -- Get existing owner
  SELECT id INTO v_owner_id FROM public.profiles WHERE email = 'owner@lalarente.com' LIMIT 1;
  
  -- Only create properties if owner exists
  IF v_owner_id IS NOT NULL THEN
    -- Create properties if they don't exist
    INSERT INTO public.properties (id, title, address, city, province, property_type, rent_amount, owner_id, status)
    VALUES 
      (gen_random_uuid(), 'Rosebank Lofts', '123 Oxford Road', 'Johannesburg', 'Gauteng', 'apartment', 12000, v_owner_id, 'available')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_prop1;
    
    INSERT INTO public.properties (id, title, address, city, province, property_type, rent_amount, owner_id, status)
    VALUES 
      (gen_random_uuid(), 'Sandton Villas', '456 Rivonia Road', 'Johannesburg', 'Gauteng', 'townhouse', 15000, v_owner_id, 'available')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_prop2;
    
    -- If properties already exist, get their IDs
    IF v_prop1 IS NULL THEN
      SELECT id INTO v_prop1 FROM public.properties WHERE title = 'Rosebank Lofts' LIMIT 1;
    END IF;
    
    IF v_prop2 IS NULL THEN
      SELECT id INTO v_prop2 FROM public.properties WHERE title = 'Sandton Villas' LIMIT 1;
    END IF;
  END IF;
END $$;

-- 3. Seed vendor services for existing vendor (Appopoleis)
DO $$
DECLARE
  v_vendor_id uuid;
  v_prop1 uuid;
  v_prop2 uuid;
BEGIN
  -- Get existing vendor and properties
  SELECT id INTO v_vendor_id FROM public.profiles WHERE email = 'appopoleis@lalarente.com' LIMIT 1;
  SELECT id INTO v_prop1 FROM public.properties WHERE title = 'Rosebank Lofts' LIMIT 1;
  SELECT id INTO v_prop2 FROM public.properties WHERE title = 'Sandton Villas' LIMIT 1;
  
  IF v_vendor_id IS NOT NULL THEN
    -- Add vendor services (using actual category IDs)
    INSERT INTO public.vendor_services (vendor_id, category_id, title, description, base_price, pricing_unit)
    SELECT v_vendor_id, c.id, 'Emergency Plumbing', '24/7 emergency plumbing services', 500, 'callout'
    FROM public.service_categories c WHERE c.name = 'Plumbing'
    ON CONFLICT DO NOTHING;
    
    INSERT INTO public.vendor_services (vendor_id, category_id, title, description, base_price, pricing_unit)
    SELECT v_vendor_id, c.id, 'Electrical Repairs', 'General electrical repairs and maintenance', 300, 'hour'
    FROM public.service_categories c WHERE c.name = 'Electrical'
    ON CONFLICT DO NOTHING;
    
    INSERT INTO public.vendor_services (vendor_id, category_id, title, description, base_price, pricing_unit)
    SELECT v_vendor_id, c.id, 'AC Servicing', 'Air conditioning maintenance and repair', 800, 'service'
    FROM public.service_categories c WHERE c.name = 'HVAC'
    ON CONFLICT DO NOTHING;
    
    -- Add vendor service areas
    INSERT INTO public.vendor_service_areas (vendor_id, city, province)
    VALUES (v_vendor_id, 'Johannesburg', 'Gauteng')
    ON CONFLICT DO NOTHING;
    
    -- Add vendor availability
    INSERT INTO public.vendor_availability_slots (vendor_id, weekday, start_time, end_time, is_recurring) VALUES
      (v_vendor_id, 1, '08:00', '17:00', true), -- Monday
      (v_vendor_id, 2, '08:00', '17:00', true), -- Tuesday
      (v_vendor_id, 3, '08:00', '17:00', true), -- Wednesday
      (v_vendor_id, 4, '08:00', '17:00', true), -- Thursday
      (v_vendor_id, 5, '08:00', '17:00', true), -- Friday
      (v_vendor_id, 6, '09:00', '15:00', true)  -- Saturday
    ON CONFLICT DO NOTHING;
    
    -- Add dedicated vendor assignments if properties exist
    IF v_prop1 IS NOT NULL THEN
      INSERT INTO public.dedicated_vendors (property_id, category_id, vendor_id, priority)
      SELECT v_prop1, c.id, v_vendor_id, 1
      FROM public.service_categories c WHERE c.name = 'Plumbing'
      ON CONFLICT DO NOTHING;
      
      INSERT INTO public.dedicated_vendors (property_id, category_id, vendor_id, priority)
      SELECT v_prop1, c.id, v_vendor_id, 1
      FROM public.service_categories c WHERE c.name = 'Electrical'
      ON CONFLICT DO NOTHING;
      
      INSERT INTO public.dedicated_vendors (property_id, category_id, vendor_id, priority)
      SELECT v_prop1, c.id, v_vendor_id, 1
      FROM public.service_categories c WHERE c.name = 'HVAC'
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF v_prop2 IS NOT NULL THEN
      INSERT INTO public.dedicated_vendors (property_id, category_id, vendor_id, priority)
      SELECT v_prop2, c.id, v_vendor_id, 1
      FROM public.service_categories c WHERE c.name = 'Plumbing'
      ON CONFLICT DO NOTHING;
      
      INSERT INTO public.dedicated_vendors (property_id, category_id, vendor_id, priority)
      SELECT v_prop2, c.id, v_vendor_id, 1
      FROM public.service_categories c WHERE c.name = 'Electrical'
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- 4. Seed sample maintenance requests
DO $$
DECLARE
  v_owner_id uuid;
  v_prop1 uuid;
  v_prop2 uuid;
  v_tenant_id uuid;
BEGIN
  -- Get existing owner, properties, and tenant
  SELECT id INTO v_owner_id FROM public.profiles WHERE email = 'owner@lalarente.com' LIMIT 1;
  SELECT id INTO v_prop1 FROM public.properties WHERE title = 'Rosebank Lofts' LIMIT 1;
  SELECT id INTO v_prop2 FROM public.properties WHERE title = 'Sandton Villas' LIMIT 1;
  SELECT id INTO v_tenant_id FROM public.profiles WHERE email = 'tenant@lalarente.com' LIMIT 1;
  
  IF v_owner_id IS NOT NULL AND v_tenant_id IS NOT NULL AND v_prop1 IS NOT NULL THEN
    -- Create maintenance requests
    INSERT INTO public.maintenance_requests (id, property_id, owner_id, tenant_id, title, description, priority, status, mms_status, created_at) VALUES
      (
        gen_random_uuid(),
        v_prop1,
        v_owner_id,
        v_tenant_id,
        'Geyser Burst',
        'Hot water geyser has burst and is leaking water. Need urgent repair.',
        'high',
        'open',
        'vendor_routed',
        now() - interval '2 hours'
      ),
      (
        gen_random_uuid(),
        v_prop1,
        v_owner_id,
        v_tenant_id,
        'Electrical Fault',
        'Power outlet in kitchen is not working. Need electrician to check and fix.',
        'medium',
        'open',
        'notification',
        now() - interval '1 day'
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF v_owner_id IS NOT NULL AND v_tenant_id IS NOT NULL AND v_prop2 IS NOT NULL THEN
    INSERT INTO public.maintenance_requests (id, property_id, owner_id, tenant_id, title, description, priority, status, mms_status, created_at) VALUES
      (
        gen_random_uuid(),
        v_prop2,
        v_owner_id,
        v_tenant_id,
        'AC Not Cooling',
        'Air conditioning unit is not cooling properly. Need HVAC technician.',
        'medium',
        'open',
        'acknowledged',
        now() - interval '3 days'
      )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 5. Create vendor quote requests for the routed maintenance request
DO $$
DECLARE
  v_request_id uuid;
  v_vendor_id uuid;
BEGIN
  -- Get the vendor_routed maintenance request
  SELECT id INTO v_request_id FROM public.maintenance_requests WHERE mms_status = 'vendor_routed' LIMIT 1;
  SELECT id INTO v_vendor_id FROM public.profiles WHERE email = 'appopoleis@lalarente.com' LIMIT 1;
  
  IF v_request_id IS NOT NULL AND v_vendor_id IS NOT NULL THEN
    INSERT INTO public.vendor_quote_requests (request_id, vendor_id, response_deadline, status) VALUES
      (v_request_id, v_vendor_id, now() + interval '24 hours', 'pending')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 6. Log audit events for the maintenance requests
DO $$
DECLARE
  v_request_id uuid;
  v_owner_id uuid;
BEGIN
  SELECT id INTO v_owner_id FROM public.profiles WHERE email = 'owner@lalarente.com' LIMIT 1;
  
  -- Only log events if owner exists
  IF v_owner_id IS NOT NULL THEN
    -- Log events for each maintenance request
    FOR v_request_id IN SELECT id FROM public.maintenance_requests LOOP
      INSERT INTO public.maintenance_request_audit_logs (request_id, event, actor_id, data) VALUES
        (v_request_id, 'notification_raised', v_owner_id, '{"priority": "medium"}')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;
