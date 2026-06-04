-- Build 5 QA demo data (idempotent)
-- Project: vvepwaolnkzfzhzgxlwr
-- Run manually in Supabase SQL Editor AFTER PR review — do not auto-run in CI
--
-- Navin (owner): e7f57cdd-78dd-41ab-9f4c-4333dd9776e6
-- Nashin (tenant): 763dea05-493e-4f38-9d34-509da8e43bd8
-- Active lease: a1b2c3d4-0001-4000-a000-000000000001
-- Property 4A Dolphin: e5e888d1-e3ce-4c5c-a007-1ae58ddcaf94

-- 1) Open payment dispute (owner dashboard / tenant track)
INSERT INTO payment_disputes (
  id, payment_id, raised_by, lease_id, reason, description, disputed_amount, status
)
SELECT
  'a1b2c3d4-0003-4000-a000-000000000001',
  'a1b2c3d4-0002-4000-a000-000000000003',
  '763dea05-493e-4f38-9d34-509da8e43bd8',
  'a1b2c3d4-0001-4000-a000-000000000001',
  'incorrect_amount',
  'Demo dispute for QA: rent amount does not match lease agreement.',
  12000.00,
  'open'
WHERE NOT EXISTS (
  SELECT 1 FROM payment_disputes WHERE id = 'a1b2c3d4-0003-4000-a000-000000000001'
);

-- 2) Second application on 4A Dolphin (enables Compare when 2+ active)
INSERT INTO rental_applications (
  id, property_id, tenant_id, status, monthly_income, created_at, updated_at
)
SELECT
  'a1b2c3d4-0004-4000-a000-000000000001',
  'e5e888d1-e3ce-4c5c-a007-1ae58ddcaf94',
  'a657852f-080f-416c-b448-0736c5298b14',
  'submitted',
  45000,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM rental_applications
  WHERE property_id = 'e5e888d1-e3ce-4c5c-a007-1ae58ddcaf94'
    AND tenant_id = 'a657852f-080f-416c-b448-0736c5298b14'
    AND status IN ('submitted', 'under_review', 'approved')
);

-- 3) Pending holding deposit for Nashin on 4A Dolphin
INSERT INTO holding_deposits (
  id, property_id, tenant_id, application_id, amount, status,
  payment_deadline, hold_expires_at, created_at, updated_at
)
SELECT
  'a1b2c3d4-0006-4000-a000-000000000001',
  'e5e888d1-e3ce-4c5c-a007-1ae58ddcaf94',
  '763dea05-493e-4f38-9d34-509da8e43bd8',
  'a1b2c3d4-0005-4000-a000-000000000001',
  5000.00,
  'pending',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '14 days',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM holding_deposits WHERE id = 'a1b2c3d4-0006-4000-a000-000000000001'
);
