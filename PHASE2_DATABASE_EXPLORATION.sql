-- ============================================
-- PHASE 2 DATABASE EXPLORATION
-- Run these queries in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. CHAT/MESSAGES TABLES
-- ============================================

-- Check if messages/chat tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%message%' OR table_name LIKE '%chat%' OR table_name LIKE '%conversation%')
ORDER BY table_name;

-- Get structure of messages table (if exists)
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- Get structure of conversations table (if exists)
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- Sample messages data
SELECT * FROM messages LIMIT 10;

-- Sample conversations data
SELECT * FROM conversations LIMIT 10;

-- ============================================
-- 2. QUOTES TABLES
-- ============================================

-- Check quotes table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'quotes'
ORDER BY ordinal_position;

-- Check quote_requests table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'quote_requests'
ORDER BY ordinal_position;

-- Sample quotes data
SELECT 
  q.id,
  q.request_id,
  q.vendor_id,
  q.total_amount,
  q.estimated_duration,
  q.warranty_period,
  q.notes,
  q.status,
  q.submitted_at,
  v.full_name as vendor_name,
  v.phone as vendor_phone
FROM quotes q
LEFT JOIN profiles v ON q.vendor_id = v.id
LIMIT 10;

-- Sample quote_requests data
SELECT * FROM quote_requests LIMIT 10;

-- Get quotes for a specific maintenance request
-- Replace 'REQUEST_ID' with actual ID
SELECT 
  q.*,
  v.full_name as vendor_name,
  v.phone as vendor_phone,
  v.email as vendor_email
FROM quotes q
LEFT JOIN profiles v ON q.vendor_id = v.id
WHERE q.request_id = 'REQUEST_ID'
ORDER BY q.submitted_at DESC;

-- ============================================
-- 3. PURCHASE ORDERS (PO) TABLES
-- ============================================

-- Check purchase_orders table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'purchase_orders'
ORDER BY ordinal_position;

-- Sample PO data
SELECT 
  po.id,
  po.request_id,
  po.vendor_id,
  po.quote_id,
  po.po_number,
  po.total_amount,
  po.status,
  po.issued_date,
  po.expected_completion_date,
  v.full_name as vendor_name,
  v.phone as vendor_phone
FROM purchase_orders po
LEFT JOIN profiles v ON po.vendor_id = v.id
LIMIT 10;

-- Get PO for a specific maintenance request
SELECT 
  po.*,
  v.full_name as vendor_name,
  v.phone as vendor_phone,
  v.email as vendor_email,
  q.total_amount as quote_amount
FROM purchase_orders po
LEFT JOIN profiles v ON po.vendor_id = v.id
LEFT JOIN quotes q ON po.quote_id = q.id
WHERE po.request_id = 'REQUEST_ID';

-- ============================================
-- 4. INVOICES TABLES
-- ============================================

-- Check invoices table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

-- Sample invoice data
SELECT 
  i.id,
  i.request_id,
  i.po_id,
  i.invoice_number,
  i.total_amount,
  i.status,
  i.issued_date,
  i.due_date,
  i.paid_date,
  v.full_name as vendor_name
FROM invoices i
LEFT JOIN purchase_orders po ON i.po_id = po.id
LEFT JOIN profiles v ON po.vendor_id = v.id
LIMIT 10;

-- Get invoice for a specific maintenance request
SELECT 
  i.*,
  po.po_number,
  v.full_name as vendor_name,
  v.phone as vendor_phone
FROM invoices i
LEFT JOIN purchase_orders po ON i.po_id = po.id
LEFT JOIN profiles v ON po.vendor_id = v.id
WHERE i.request_id = 'REQUEST_ID';

-- ============================================
-- 5. TIMELINE/ACTIVITY TABLES
-- ============================================

-- Check for activity/timeline tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%activity%' OR table_name LIKE '%timeline%' OR table_name LIKE '%log%' OR table_name LIKE '%history%')
ORDER BY table_name;

-- Check maintenance_activities table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'maintenance_activities'
ORDER BY ordinal_position;

-- Sample activity data
SELECT * FROM maintenance_activities LIMIT 10;

-- Get timeline for a specific maintenance request
SELECT 
  ma.*,
  p.full_name as actor_name
FROM maintenance_activities ma
LEFT JOIN profiles p ON ma.actor_id = p.id
WHERE ma.request_id = 'REQUEST_ID'
ORDER BY ma.created_at ASC;

-- ============================================
-- 6. WORK UPDATES/PROGRESS TABLES
-- ============================================

-- Check for work updates tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%work%' OR table_name LIKE '%progress%' OR table_name LIKE '%update%')
ORDER BY table_name;

-- Check work_updates table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'work_updates'
ORDER BY ordinal_position;

-- Sample work updates
SELECT * FROM work_updates LIMIT 10;

-- ============================================
-- 7. COMPLETE MAINTENANCE REQUEST WITH ALL RELATIONS
-- ============================================

-- Get complete request data with all relations
SELECT 
  mr.id,
  mr.title,
  mr.description,
  mr.status,
  mr.priority,
  mr.visibility,
  mr.category_id,
  mr.property_id,
  mr.owner_id,
  mr.tenant_id,
  mr.selected_vendor_id,
  mr.selected_quote_id,
  mr.po_id,
  mr.mms_status,
  mr.acknowledged_at,
  mr.vendor_routed_at,
  mr.created_at,
  mr.completed_date,
  mr.estimated_cost,
  mr.actual_cost,
  mr.images,
  
  -- Property details
  p.title as property_title,
  p.address as property_address,
  p.city as property_city,
  
  -- Owner details
  o.full_name as owner_name,
  o.email as owner_email,
  o.phone as owner_phone,
  
  -- Tenant details
  t.full_name as tenant_name,
  t.email as tenant_email,
  t.phone as tenant_phone,
  
  -- Category details
  sc.name as category_name,
  
  -- Selected vendor details
  sv.full_name as selected_vendor_name,
  sv.phone as selected_vendor_phone,
  
  -- Count of quotes
  (SELECT COUNT(*) FROM quotes WHERE request_id = mr.id) as quote_count,
  
  -- Count of messages
  (SELECT COUNT(*) FROM messages WHERE request_id = mr.id) as message_count
  
FROM maintenance_requests mr
LEFT JOIN properties p ON mr.property_id = p.id
LEFT JOIN profiles o ON mr.owner_id = o.id
LEFT JOIN profiles t ON mr.tenant_id = t.id
LEFT JOIN service_categories sc ON mr.category_id = sc.id
LEFT JOIN profiles sv ON mr.selected_vendor_id = sv.id
ORDER BY mr.created_at DESC
LIMIT 5;

-- ============================================
-- 8. CHECK ALL RELATED TABLES
-- ============================================

-- List all tables that might be related to maintenance
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (
    table_name LIKE '%maintenance%' 
    OR table_name LIKE '%quote%'
    OR table_name LIKE '%purchase%'
    OR table_name LIKE '%invoice%'
    OR table_name LIKE '%message%'
    OR table_name LIKE '%chat%'
    OR table_name LIKE '%vendor%'
  )
ORDER BY table_name;

-- ============================================
-- 9. CHECK FOREIGN KEY RELATIONSHIPS
-- ============================================

-- Get all foreign keys related to maintenance_requests
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (tc.table_name LIKE '%maintenance%' 
    OR tc.table_name LIKE '%quote%'
    OR tc.table_name LIKE '%purchase%'
    OR tc.table_name LIKE '%invoice%'
    OR tc.table_name LIKE '%message%')
ORDER BY tc.table_name;

-- ============================================
-- 10. SAMPLE DATA FOR TESTING
-- ============================================

-- Get a complete maintenance request with all related data
-- Replace 'REQUEST_ID' with actual ID from your database
WITH request_data AS (
  SELECT * FROM maintenance_requests WHERE id = 'REQUEST_ID'
)
SELECT 
  'Request' as data_type,
  json_build_object(
    'id', rd.id,
    'title', rd.title,
    'status', rd.status,
    'priority', rd.priority
  ) as data
FROM request_data rd

UNION ALL

SELECT 
  'Quotes' as data_type,
  json_agg(json_build_object(
    'id', q.id,
    'vendor_name', v.full_name,
    'amount', q.total_amount,
    'status', q.status
  )) as data
FROM quotes q
LEFT JOIN profiles v ON q.vendor_id = v.id
WHERE q.request_id = 'REQUEST_ID'

UNION ALL

SELECT 
  'Messages' as data_type,
  json_agg(json_build_object(
    'id', m.id,
    'sender', p.full_name,
    'message', m.content,
    'created_at', m.created_at
  )) as data
FROM messages m
LEFT JOIN profiles p ON m.sender_id = p.id
WHERE m.request_id = 'REQUEST_ID'
ORDER BY data_type;

-- ============================================
-- 11. COUNT SUMMARY
-- ============================================

-- Get counts of all related data
SELECT 
  'Maintenance Requests' as entity,
  COUNT(*) as count
FROM maintenance_requests

UNION ALL

SELECT 
  'Quotes' as entity,
  COUNT(*) as count
FROM quotes

UNION ALL

SELECT 
  'Purchase Orders' as entity,
  COUNT(*) as count
FROM purchase_orders

UNION ALL

SELECT 
  'Invoices' as entity,
  COUNT(*) as count
FROM invoices

UNION ALL

SELECT 
  'Messages' as entity,
  COUNT(*) as count
FROM messages

ORDER BY entity;
