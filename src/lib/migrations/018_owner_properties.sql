-- Add properties for the actual owner (arsalanahmed82@hotmail.com)
DO $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Get the actual owner
  SELECT id INTO v_owner_id FROM public.profiles WHERE email = 'arsalanahmed82@hotmail.com' LIMIT 1;
  
  -- Only create properties if owner exists
  IF v_owner_id IS NOT NULL THEN
    -- Create properties for the actual owner
    INSERT INTO public.properties (id, title, address, city, province, property_type, rent_amount, owner_id, status)
    VALUES 
      (gen_random_uuid(), 'Rosebank Apartment 5C', '123 Oxford Road, Rosebank', 'Johannesburg', 'Gauteng', 'apartment', 12000, v_owner_id, 'available'),
      (gen_random_uuid(), 'Sandton Townhouse 3A', '456 Rivonia Road, Sandton', 'Johannesburg', 'Gauteng', 'townhouse', 15000, v_owner_id, 'available'),
      (gen_random_uuid(), 'Melville Studio 2B', '789 7th Street, Melville', 'Johannesburg', 'Gauteng', 'studio', 8000, v_owner_id, 'available')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created properties for owner: %', v_owner_id;
  ELSE
    RAISE NOTICE 'Owner arsalanahmed82@hotmail.com not found';
  END IF;
END $$;

