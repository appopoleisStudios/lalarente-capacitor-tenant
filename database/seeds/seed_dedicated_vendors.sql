-- Seed: Dedicated Vendors for Navin's Demo Properties
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)
--
-- Idempotent: safe to run multiple times (uses INSERT ... ON CONFLICT)
--
-- Creates: 3 vendor profiles + dedicated_vendors links
--   • Sipho Ndlovu – Plumber, Sipho Plumbing cc
--   • Thabo Mokoena – Electrician, TM Electrical
--   • Zanele Dlamini – General Contractor, Zanele Maintenance
--
-- Prerequisites:
--   Auth users already exist (created via Auth Admin API in prior step):
--     sipho@siphoplumbing.co.za    (ID: 0cd2ac2f-645f-40d4-af81-97c7342170d9)
--     thabo@tmelectrical.co.za     (ID: aa2fb26b-052b-40e4-bf01-07c6be5cb233)
--     zanele@zanelem.co.za         (ID: f803d3bd-197a-44cf-a31e-71d3a187fe63)

-- ============================================================================
-- 1. Vendor Profiles
-- ============================================================================
INSERT INTO public.profiles (id, full_name, email, phone, role, created_at, updated_at)
VALUES
  ('0cd2ac2f-645f-40d4-af81-97c7342170d9', 'Sipho Ndlovu',  'sipho@siphoplumbing.co.za', '071 234 5678', 'vendor', NOW(), NOW()),
  ('aa2fb26b-052b-40e4-bf01-07c6be5cb233', 'Thabo Mokoena',  'thabo@tmelectrical.co.za',  '082 345 6789', 'vendor', NOW(), NOW()),
  ('f803d3bd-197a-44cf-a31e-71d3a187fe63', 'Zanele Dlamini', 'zanele@zanelem.co.za',     '063 456 7890', 'vendor', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email     = EXCLUDED.email,
  phone     = EXCLUDED.phone,
  role      = EXCLUDED.role;

-- ============================================================================
-- 2. Dedicated Vendor Links → Navin's Properties
--    Properties: 4A Dolphin + 4B Dolphin Crescent Umhlali Beach
-- ============================================================================
INSERT INTO public.dedicated_vendors (vendor_id, property_id, is_active, created_at)
SELECT v.id, p.id, true, NOW()
FROM (VALUES
  ('0cd2ac2f-645f-40d4-af81-97c7342170d9'),
  ('aa2fb26b-052b-40e4-bf01-07c6be5cb233'),
  ('f803d3bd-197a-44cf-a31e-71d3a187fe63')
) AS v(id)
CROSS JOIN (VALUES
  ('e5e888d1-e3ce-4c5c-a007-1ae58ddcaf94'),  -- 4A Dolphin
  ('d119e29f-013f-4bde-a066-6c445a1365c1')   -- 4B Dolphin Crescent Umhlali Beach
) AS p(id)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. Cleanup: Remove test user created during API testing
-- ============================================================================
DELETE FROM auth.users WHERE email = 'debug-test@test.com';

-- ============================================================================
-- 4. Verification Queries (uncomment to check results)
-- ============================================================================
-- SELECT id, full_name, email, role FROM profiles WHERE role = 'vendor';
-- SELECT dv.*, p.full_name AS vendor_name, pr.title AS property
-- FROM dedicated_vendors dv
-- JOIN profiles p ON p.id = dv.vendor_id
-- JOIN properties pr ON pr.id = dv.property_id
-- ORDER BY p.full_name, pr.title;
