-- ============================================================================
-- SEED: Vendor Payment Demo Data for Admin Panel
-- ============================================================================
-- Run this in Supabase SQL Editor.
-- Idempotent: safe to run multiple times.
-- ============================================================================

-- ============================================================================
-- 1. Assign vendors to existing maintenance requests
-- ============================================================================
UPDATE maintenance_requests SET vendor_id = '0cd2ac2f-645f-40d4-af81-97c7342170d9',  estimated_cost = 1850.00  WHERE id = '6ddd848d-fa8b-4aa5-946e-2c2215e95dfa'  AND vendor_id IS NULL;
UPDATE maintenance_requests SET vendor_id = 'df001c4c-2642-46ab-be5b-13cafc995354', estimated_cost = 4500.00  WHERE id = 'a1b2c3d4-0003-4000-a000-000000000001' AND vendor_id IS NULL;
UPDATE maintenance_requests SET vendor_id = 'f803d3bd-197a-44cf-a31e-71d3a187fe63', estimated_cost = 1250.00  WHERE id = 'a1b2c3d4-0003-4000-a000-000000000002' AND vendor_id IS NULL;
UPDATE maintenance_requests SET vendor_id = 'aa2fb26b-052b-40e4-bf01-07c6be5cb233', estimated_cost = 2800.00  WHERE id = '485b9885-2820-4211-89c0-de177773f812' AND vendor_id IS NULL;
UPDATE maintenance_requests SET vendor_id = '0cd2ac2f-645f-40d4-af81-97c7342170d9',  estimated_cost = 950.00   WHERE id = '756d56a6-3902-44a6-8ca8-55aaff2d14f8' AND vendor_id IS NULL;
UPDATE maintenance_requests SET vendor_id = 'aa2fb26b-052b-40e4-bf01-07c6be5cb233', estimated_cost = 3200.00  WHERE id = '95be4f38-c7a5-4333-bdc9-787c51c53261' AND vendor_id IS NULL;
UPDATE maintenance_requests SET vendor_id = '4c396627-2394-4d7d-b446-43fa52912531', estimated_cost = 2100.00  WHERE id = 'ac90e37c-e35d-474e-b8b5-9a7748368f8d' AND vendor_id IS NULL;
UPDATE maintenance_requests SET vendor_id = 'a7a97b81-4389-4248-9e75-da9e12a4ee31', estimated_cost = 1500.00  WHERE id = 'f053385a-d344-4fa4-99d6-38872bdbb10b' AND vendor_id IS NULL;

-- ============================================================================
-- 2. Create invoices (using subqueries for FK columns)
-- ============================================================================
INSERT INTO maintenance_invoices (id, maintenance_request_id, vendor_id, owner_id, property_id, invoice_number, status, line_items, subtotal, vat_amount, total_amount, payer_role, created_at, updated_at)
SELECT gen_random_uuid(), mr.id, mr.vendor_id, mr.owner_id, mr.property_id, 'INV-2026-001', 'submitted', '[{"description":"Unblock toilet + replace flush mechanism","quantity":1,"unit_price":1608.70}]'::jsonb, 1608.70, 241.30, 1850.00, 'tenant', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'
FROM maintenance_requests mr WHERE mr.id = '6ddd848d-fa8b-4aa5-946e-2c2215e95dfa' AND mr.vendor_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM maintenance_invoices WHERE invoice_number = 'INV-2026-001');

INSERT INTO maintenance_invoices (id, maintenance_request_id, vendor_id, owner_id, property_id, invoice_number, status, line_items, subtotal, vat_amount, total_amount, payer_role, created_at, updated_at)
SELECT gen_random_uuid(), mr.id, mr.vendor_id, mr.owner_id, mr.property_id, 'INV-2026-002', 'submitted', '[{"description":"Replace geyser element + thermostat","quantity":1,"unit_price":3913.04}]'::jsonb, 3913.04, 586.96, 4500.00, 'tenant', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'
FROM maintenance_requests mr WHERE mr.id = 'a1b2c3d4-0003-4000-a000-000000000001' AND mr.vendor_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM maintenance_invoices WHERE invoice_number = 'INV-2026-002');

INSERT INTO maintenance_invoices (id, maintenance_request_id, vendor_id, owner_id, property_id, invoice_number, status, line_items, subtotal, vat_amount, total_amount, payer_role, created_at, updated_at)
SELECT gen_random_uuid(), mr.id, mr.vendor_id, mr.owner_id, mr.property_id, 'INV-2026-003', 'submitted', '[{"description":"Repair garden gate latch + hinge","quantity":1,"unit_price":1086.96}]'::jsonb, 1086.96, 163.04, 1250.00, 'tenant', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'
FROM maintenance_requests mr WHERE mr.id = 'a1b2c3d4-0003-4000-a000-000000000002' AND mr.vendor_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM maintenance_invoices WHERE invoice_number = 'INV-2026-003');

INSERT INTO maintenance_invoices (id, maintenance_request_id, vendor_id, owner_id, property_id, invoice_number, status, line_items, subtotal, vat_amount, total_amount, payer_role, created_at, updated_at)
SELECT gen_random_uuid(), mr.id, mr.vendor_id, mr.owner_id, mr.property_id, 'INV-2026-004', 'submitted', '[{"description":"Replace faulty light switches + wiring repair","quantity":1,"unit_price":2434.78}]'::jsonb, 2434.78, 365.22, 2800.00, 'owner', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'
FROM maintenance_requests mr WHERE mr.id = '485b9885-2820-4211-89c0-de177773f812' AND mr.vendor_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM maintenance_invoices WHERE invoice_number = 'INV-2026-004');

INSERT INTO maintenance_invoices (id, maintenance_request_id, vendor_id, owner_id, property_id, invoice_number, status, line_items, subtotal, vat_amount, total_amount, payer_role, created_at, updated_at)
SELECT gen_random_uuid(), mr.id, mr.vendor_id, mr.owner_id, mr.property_id, 'INV-2026-005', 'submitted', '[{"description":"Replace kitchen faucet washer","quantity":1,"unit_price":826.09}]'::jsonb, 826.09, 123.91, 950.00, 'tenant', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'
FROM maintenance_requests mr WHERE mr.id = '756d56a6-3902-44a6-8ca8-55aaff2d14f8' AND mr.vendor_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM maintenance_invoices WHERE invoice_number = 'INV-2026-005');

INSERT INTO maintenance_invoices (id, maintenance_request_id, vendor_id, owner_id, property_id, invoice_number, status, line_items, subtotal, vat_amount, total_amount, payer_role, created_at, updated_at)
SELECT gen_random_uuid(), mr.id, mr.vendor_id, mr.owner_id, mr.property_id, 'INV-2026-006', 'submitted', '[{"description":"AC diagnostic + refrigerant top-up","quantity":1,"unit_price":2782.61}]'::jsonb, 2782.61, 417.39, 3200.00, 'tenant', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
FROM maintenance_requests mr WHERE mr.id = '95be4f38-c7a5-4333-bdc9-787c51c53261' AND mr.vendor_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM maintenance_invoices WHERE invoice_number = 'INV-2026-006');

INSERT INTO maintenance_invoices (id, maintenance_request_id, vendor_id, owner_id, property_id, invoice_number, status, line_items, subtotal, vat_amount, total_amount, payer_role, created_at, updated_at)
SELECT gen_random_uuid(), mr.id, mr.vendor_id, mr.owner_id, mr.property_id, 'INV-2026-007', 'submitted', '[{"description":"Drainage pipe unclog + clean","quantity":1,"unit_price":1826.09}]'::jsonb, 1826.09, 273.91, 2100.00, 'owner', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
FROM maintenance_requests mr WHERE mr.id = 'ac90e37c-e35d-474e-b8b5-9a7748368f8d' AND mr.vendor_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM maintenance_invoices WHERE invoice_number = 'INV-2026-007');

INSERT INTO maintenance_invoices (id, maintenance_request_id, vendor_id, owner_id, property_id, invoice_number, status, line_items, subtotal, vat_amount, total_amount, payer_role, created_at, updated_at)
SELECT gen_random_uuid(), mr.id, mr.vendor_id, mr.owner_id, mr.property_id, 'INV-2026-008', 'submitted', '[{"description":"AC filter cleaning + service","quantity":1,"unit_price":1304.35}]'::jsonb, 1304.35, 195.65, 1500.00, 'owner', NOW(), NOW()
FROM maintenance_requests mr WHERE mr.id = 'f053385a-d344-4fa4-99d6-38872bdbb10b' AND mr.vendor_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM maintenance_invoices WHERE invoice_number = 'INV-2026-008');

-- ============================================================================
-- 3. Create vendor_payments (using maintenance_requests JOIN for FK columns)
-- ============================================================================

-- 3a. Completed + sent payout (Sipho — Toilet not flushing)
INSERT INTO vendor_payments (id, invoice_id, maintenance_request_id, tenant_id, vendor_id, owner_id, total_amount, platform_fee, platform_fee_percent, gateway_fee, payout_fee, vendor_payout, payment_status, payout_status, payout_method, payout_reference, paid_at, payout_initiated_at, payout_completed_at, created_at, updated_at)
SELECT gen_random_uuid(), mi.id, mi.maintenance_request_id, COALESCE(mr.tenant_id, '763dea05-493e-4f38-9d34-509da8e43bd8'), mr.vendor_id, mr.owner_id, 1850.00, 185.00, 10.00, 12.50, 15.00, 1650.00, 'completed', 'sent', 'manual_eft', 'EFT-REF-001', NOW() - INTERVAL '12 days', NOW() - INTERVAL '11 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days'
FROM maintenance_invoices mi JOIN maintenance_requests mr ON mr.id = mi.maintenance_request_id WHERE mi.invoice_number = 'INV-2026-001'
AND NOT EXISTS (SELECT 1 FROM vendor_payments vp WHERE vp.invoice_id = mi.id AND vp.payment_status = 'completed');

-- 3b. Completed + pending payout (Sipho Dlamini — Geyser leaking)
INSERT INTO vendor_payments (id, invoice_id, maintenance_request_id, tenant_id, vendor_id, owner_id, total_amount, platform_fee, platform_fee_percent, gateway_fee, payout_fee, vendor_payout, payment_status, payout_status, payout_method, paid_at, created_at, updated_at)
SELECT gen_random_uuid(), mi.id, mi.maintenance_request_id, COALESCE(mr.tenant_id, '763dea05-493e-4f38-9d34-509da8e43bd8'), mr.vendor_id, mr.owner_id, 4500.00, 450.00, 10.00, 22.50, 35.00, 4015.00, 'completed', 'pending', 'manual_eft', NOW() - INTERVAL '8 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days'
FROM maintenance_invoices mi JOIN maintenance_requests mr ON mr.id = mi.maintenance_request_id WHERE mi.invoice_number = 'INV-2026-002'
AND NOT EXISTS (SELECT 1 FROM vendor_payments vp WHERE vp.invoice_id = mi.id AND vp.payment_status = 'completed');

-- 3c. Completed + processing payout (Zanele — Garden gate latch)
INSERT INTO vendor_payments (id, invoice_id, maintenance_request_id, tenant_id, vendor_id, owner_id, total_amount, platform_fee, platform_fee_percent, gateway_fee, payout_fee, vendor_payout, payment_status, payout_status, payout_method, payout_reference, paid_at, payout_initiated_at, created_at, updated_at)
SELECT gen_random_uuid(), mi.id, mi.maintenance_request_id, COALESCE(mr.tenant_id, '763dea05-493e-4f38-9d34-509da8e43bd8'), mr.vendor_id, mr.owner_id, 1250.00, 125.00, 10.00, 8.50, 10.00, 1115.00, 'completed', 'processing', 'manual_eft', 'EFT-REF-002', NOW() - INTERVAL '6 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '4 days'
FROM maintenance_invoices mi JOIN maintenance_requests mr ON mr.id = mi.maintenance_request_id WHERE mi.invoice_number = 'INV-2026-003'
AND NOT EXISTS (SELECT 1 FROM vendor_payments vp WHERE vp.invoice_id = mi.id AND vp.payment_status = 'completed');

-- 3d. Completed + dispute opened (Thabo — Lights not working)
INSERT INTO vendor_payments (id, invoice_id, maintenance_request_id, tenant_id, vendor_id, owner_id, total_amount, platform_fee, platform_fee_percent, gateway_fee, payout_fee, vendor_payout, payment_status, payout_status, payout_method, dispute_status, paid_at, created_at, updated_at)
SELECT gen_random_uuid(), mi.id, mi.maintenance_request_id, COALESCE(mr.tenant_id, 'a657852f-080f-416c-b448-0736c5298b14'), mr.vendor_id, mr.owner_id, 2800.00, 280.00, 10.00, 15.00, 20.00, 2500.00, 'completed', 'on_hold', 'manual_eft', 'opened', NOW() - INTERVAL '3 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days'
FROM maintenance_invoices mi JOIN maintenance_requests mr ON mr.id = mi.maintenance_request_id WHERE mi.invoice_number = 'INV-2026-004'
AND NOT EXISTS (SELECT 1 FROM vendor_payments vp WHERE vp.invoice_id = mi.id AND vp.payment_status = 'completed');

-- 3e. Failed payment (Sipho — Leaking faucet)
INSERT INTO vendor_payments (id, invoice_id, maintenance_request_id, tenant_id, vendor_id, owner_id, total_amount, platform_fee, platform_fee_percent, gateway_fee, payout_fee, vendor_payout, payment_status, payout_status, payout_method, created_at, updated_at)
SELECT gen_random_uuid(), mi.id, mi.maintenance_request_id, COALESCE(mr.tenant_id, '763dea05-493e-4f38-9d34-509da8e43bd8'), mr.vendor_id, mr.owner_id, 950.00, 95.00, 10.00, 6.50, 8.00, 847.00, 'failed', 'pending', 'manual_eft', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
FROM maintenance_invoices mi JOIN maintenance_requests mr ON mr.id = mi.maintenance_request_id WHERE mi.invoice_number = 'INV-2026-005'
AND NOT EXISTS (SELECT 1 FROM vendor_payments vp WHERE vp.invoice_id = mi.id AND vp.payment_status = 'failed');

-- 3f. Pending payment (Thabo — AC leak)
INSERT INTO vendor_payments (id, invoice_id, maintenance_request_id, tenant_id, vendor_id, owner_id, total_amount, platform_fee, platform_fee_percent, gateway_fee, payout_fee, vendor_payout, payment_status, payout_status, payout_method, created_at, updated_at)
SELECT gen_random_uuid(), mi.id, mi.maintenance_request_id, COALESCE(mr.tenant_id, '763dea05-493e-4f38-9d34-509da8e43bd8'), mr.vendor_id, mr.owner_id, 3200.00, 320.00, 10.00, 18.00, 25.00, 2855.00, 'pending', 'pending', 'manual_eft', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
FROM maintenance_invoices mi JOIN maintenance_requests mr ON mr.id = mi.maintenance_request_id WHERE mi.invoice_number = 'INV-2026-006'
AND NOT EXISTS (SELECT 1 FROM vendor_payments vp WHERE vp.invoice_id = mi.id AND vp.payment_status = 'pending');

-- ============================================================================
-- 4. Create vendor_payment_ledger for completed payments
-- ============================================================================

-- 4a. Ledger for INV-2026-001 (completed + sent — full lifecycle)
INSERT INTO vendor_payment_ledger (vendor_payment_id, entry_type, amount, running_balance, description, created_at)
SELECT vp.id, 'payment_received', vp.total_amount, vp.total_amount, 'Tenant payment received via PayFast', vp.created_at
FROM vendor_payments vp JOIN maintenance_invoices mi ON mi.id = vp.invoice_id WHERE mi.invoice_number = 'INV-2026-001'
AND NOT EXISTS (SELECT 1 FROM vendor_payment_ledger vpl WHERE vpl.vendor_payment_id = vp.id AND vpl.entry_type = 'payment_received');

INSERT INTO vendor_payment_ledger (vendor_payment_id, entry_type, amount, running_balance, description, created_at)
SELECT vp.id, 'platform_fee', -vp.platform_fee, vp.total_amount - vp.platform_fee, 'Platform commission (10%)', vp.paid_at
FROM vendor_payments vp JOIN maintenance_invoices mi ON mi.id = vp.invoice_id WHERE mi.invoice_number = 'INV-2026-001'
AND NOT EXISTS (SELECT 1 FROM vendor_payment_ledger vpl WHERE vpl.vendor_payment_id = vp.id AND vpl.entry_type = 'platform_fee');

INSERT INTO vendor_payment_ledger (vendor_payment_id, entry_type, amount, running_balance, description, created_at)
SELECT vp.id, 'gateway_fee', -vp.gateway_fee, vp.total_amount - vp.platform_fee - vp.gateway_fee, 'PayFast transaction fee', vp.paid_at
FROM vendor_payments vp JOIN maintenance_invoices mi ON mi.id = vp.invoice_id WHERE mi.invoice_number = 'INV-2026-001'
AND NOT EXISTS (SELECT 1 FROM vendor_payment_ledger vpl WHERE vpl.vendor_payment_id = vp.id AND vpl.entry_type = 'gateway_fee');

INSERT INTO vendor_payment_ledger (vendor_payment_id, entry_type, amount, running_balance, description, created_at)
SELECT vp.id, 'payout_sent', -vp.vendor_payout, vp.net_revenue, 'Vendor payout disbursed via EFT', vp.payout_completed_at
FROM vendor_payments vp JOIN maintenance_invoices mi ON mi.id = vp.invoice_id WHERE mi.invoice_number = 'INV-2026-001'
AND NOT EXISTS (SELECT 1 FROM vendor_payment_ledger vpl WHERE vpl.vendor_payment_id = vp.id AND vpl.entry_type = 'payout_sent');

-- 4b. Ledger for INV-2026-002 (completed + pending — no payout yet)
INSERT INTO vendor_payment_ledger (vendor_payment_id, entry_type, amount, running_balance, description, created_at)
SELECT vp.id, 'payment_received', vp.total_amount, vp.total_amount, 'Tenant payment received via PayFast', vp.created_at
FROM vendor_payments vp JOIN maintenance_invoices mi ON mi.id = vp.invoice_id WHERE mi.invoice_number = 'INV-2026-002'
AND NOT EXISTS (SELECT 1 FROM vendor_payment_ledger vpl WHERE vpl.vendor_payment_id = vp.id AND vpl.entry_type = 'payment_received');

INSERT INTO vendor_payment_ledger (vendor_payment_id, entry_type, amount, running_balance, description, created_at)
SELECT vp.id, 'platform_fee', -vp.platform_fee, vp.total_amount - vp.platform_fee, 'Platform commission (10%)', vp.paid_at
FROM vendor_payments vp JOIN maintenance_invoices mi ON mi.id = vp.invoice_id WHERE mi.invoice_number = 'INV-2026-002'
AND NOT EXISTS (SELECT 1 FROM vendor_payment_ledger vpl WHERE vpl.vendor_payment_id = vp.id AND vpl.entry_type = 'platform_fee');

INSERT INTO vendor_payment_ledger (vendor_payment_id, entry_type, amount, running_balance, description, created_at)
SELECT vp.id, 'gateway_fee', -vp.gateway_fee, vp.total_amount - vp.platform_fee - vp.gateway_fee, 'PayFast transaction fee', vp.paid_at
FROM vendor_payments vp JOIN maintenance_invoices mi ON mi.id = vp.invoice_id WHERE mi.invoice_number = 'INV-2026-002'
AND NOT EXISTS (SELECT 1 FROM vendor_payment_ledger vpl WHERE vpl.vendor_payment_id = vp.id AND vpl.entry_type = 'gateway_fee');

-- ============================================================================
-- DONE
-- ============================================================================
-- Refresh admin panel at https://admin-livid-five.vercel.app/payments
-- to see real data in:
--   Vendor Revenue tab → 8 stat cards with values + 5 transaction rows
--   Disputes tab → Active dispute (R2,800 - Lights not working)
--   Vendor Payouts page → Pending/processing payouts + Batch Initiate button
-- ============================================================================
