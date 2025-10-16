-- ============================================
-- FINAL DATABASE QUERIES - CONTRACTS
-- ============================================

-- 1. Check contracts table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'contracts'
ORDER BY ordinal_position;

-- 2. Sample contracts data
SELECT * FROM contracts LIMIT 5;

-- 3. Get contract with quote and PO
SELECT 
  c.*,
  q.total_amount as quote_amount,
  q.status as quote_status,
  po.po_number,
  po.status as po_status,
  v.full_name as vendor_name,
  mr.title as request_title
FROM contracts c
LEFT JOIN quotes q ON c.id = q.contract_id
LEFT JOIN purchase_orders po ON c.id = po.contract_id
LEFT JOIN profiles v ON q.vendor_id = v.id
LEFT JOIN maintenance_requests mr ON q.request_id = mr.id
LIMIT 5;

-- 4. Get complete flow: Request -> Quote -> Contract -> PO
SELECT 
  mr.id as request_id,
  mr.title as request_title,
  mr.status as request_status,
  q.id as quote_id,
  q.total_amount as quote_amount,
  q.status as quote_status,
  c.id as contract_id,
  po.id as po_id,
  po.po_number,
  po.status as po_status,
  v.full_name as vendor_name
FROM maintenance_requests mr
LEFT JOIN quotes q ON mr.id = q.request_id
LEFT JOIN contracts c ON q.contract_id = c.id
LEFT JOIN purchase_orders po ON c.id = po.contract_id
LEFT JOIN profiles v ON q.vendor_id = v.id
WHERE mr.id = 'REQUEST_ID';
