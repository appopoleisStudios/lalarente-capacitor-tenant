-- ============================================
-- PHASE 2 UPDATED DATABASE QUERIES
-- Based on actual messages table structure
-- ============================================

-- ============================================
-- 1. MESSAGES TABLE - VERIFIED STRUCTURE
-- ============================================

-- Get messages for a specific property and topic (maintenance request)
-- Replace 'PROPERTY_ID' and 'TOPIC' with actual values
SELECT 
  m.id,
  m.property_id,
  m.topic,
  m.sender_id,
  m.recipient_id,
  m.content,
  m.message_type,
  m.attachments,
  m.read_at,
  m.created_at,
  m.extension,
  m.event,
  m.payload,
  m.private,
  sender.full_name as sender_name,
  sender.avatar_url as sender_avatar,
  recipient.full_name as recipient_name
FROM messages m
LEFT JOIN profiles sender ON m.sender_id = sender.id
LEFT JOIN profiles recipient ON m.recipient_id = recipient.id
WHERE m.property_id = 'PROPERTY_ID'
  AND m.topic = 'maintenance_request_ID'
ORDER BY m.created_at ASC;

-- Count unread messages for a user
SELECT 
  COUNT(*) as unread_count
FROM messages
WHERE recipient_id = 'USER_ID'
  AND read_at IS NULL;

-- Get recent conversations for a property
SELECT 
  m.topic,
  m.property_id,
  MAX(m.created_at) as last_message_at,
  COUNT(*) as message_count,
  COUNT(CASE WHEN m.read_at IS NULL AND m.recipient_id = 'USER_ID' THEN 1 END) as unread_count
FROM messages m
WHERE m.property_id = 'PROPERTY_ID'
GROUP BY m.topic, m.property_id
ORDER BY last_message_at DESC;

-- Get messages with attachments
SELECT 
  m.*,
  sender.full_name as sender_name
FROM messages m
LEFT JOIN profiles sender ON m.sender_id = sender.id
WHERE m.attachments IS NOT NULL
  AND array_length(m.attachments, 1) > 0
ORDER BY m.created_at DESC
LIMIT 10;

-- ============================================
-- 2. QUOTES TABLE
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

-- Get all quotes with vendor details
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
  q.valid_until,
  q.breakdown,
  v.full_name as vendor_name,
  v.phone as vendor_phone,
  v.email as vendor_email,
  v.business_name as vendor_business,
  mr.title as request_title,
  mr.status as request_status
FROM quotes q
LEFT JOIN profiles v ON q.vendor_id = v.id
LEFT JOIN maintenance_requests mr ON q.request_id = mr.id
ORDER BY q.submitted_at DESC
LIMIT 10;

-- Get quotes for a specific maintenance request
SELECT 
  q.*,
  v.full_name as vendor_name,
  v.phone as vendor_phone,
  v.email as vendor_email,
  v.avatar_url as vendor_avatar,
  v.business_name as vendor_business
FROM quotes q
LEFT JOIN profiles v ON q.vendor_id = v.id
WHERE q.request_id = 'REQUEST_ID'
ORDER BY q.submitted_at DESC;

-- Get accepted quote for a request
SELECT 
  q.*,
  v.full_name as vendor_name,
  v.phone as vendor_phone
FROM quotes q
LEFT JOIN profiles v ON q.vendor_id = v.id
WHERE q.request_id = 'REQUEST_ID'
  AND q.status = 'accepted'
LIMIT 1;

-- ============================================
-- 3. PURCHASE ORDERS TABLE
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

-- Get all purchase orders with details
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
  po.actual_completion_date,
  po.terms,
  po.notes,
  v.full_name as vendor_name,
  v.phone as vendor_phone,
  v.business_name as vendor_business,
  mr.title as request_title,
  q.total_amount as quote_amount
FROM purchase_orders po
LEFT JOIN profiles v ON po.vendor_id = v.id
LEFT JOIN maintenance_requests mr ON po.request_id = mr.id
LEFT JOIN quotes q ON po.quote_id = q.id
ORDER BY po.issued_date DESC
LIMIT 10;

-- Get PO for a specific maintenance request
SELECT 
  po.*,
  v.full_name as vendor_name,
  v.phone as vendor_phone,
  v.email as vendor_email,
  v.business_name as vendor_business,
  q.total_amount as quote_amount,
  q.breakdown as quote_breakdown
FROM purchase_orders po
LEFT JOIN profiles v ON po.vendor_id = v.id
LEFT JOIN quotes q ON po.quote_id = q.id
WHERE po.request_id = 'REQUEST_ID';

-- ============================================
-- 4. INVOICES TABLE
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

-- Get all invoices with details
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
  i.payment_method,
  i.notes,
  po.po_number,
  v.full_name as vendor_name,
  v.business_name as vendor_business,
  mr.title as request_title
FROM invoices i
LEFT JOIN purchase_orders po ON i.po_id = po.id
LEFT JOIN profiles v ON po.vendor_id = v.id
LEFT JOIN maintenance_requests mr ON i.request_id = mr.id
ORDER BY i.issued_date DESC
LIMIT 10;

-- Get invoice for a specific maintenance request
SELECT 
  i.*,
  po.po_number,
  po.total_amount as po_amount,
  v.full_name as vendor_name,
  v.phone as vendor_phone,
  v.business_name as vendor_business
FROM invoices i
LEFT JOIN purchase_orders po ON i.po_id = po.id
LEFT JOIN profiles v ON po.vendor_id = v.id
WHERE i.request_id = 'REQUEST_ID';

-- ============================================
-- 5. MAINTENANCE ACTIVITIES/TIMELINE
-- ============================================

-- Check maintenance_activities table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'maintenance_activities'
ORDER BY ordinal_position;

-- Get timeline for a maintenance request
SELECT 
  ma.id,
  ma.request_id,
  ma.actor_id,
  ma.action,
  ma.description,
  ma.metadata,
  ma.created_at,
  p.full_name as actor_name,
  p.role as actor_role
FROM maintenance_activities ma
LEFT JOIN profiles p ON ma.actor_id = p.id
WHERE ma.request_id = 'REQUEST_ID'
ORDER BY ma.created_at ASC;

-- ============================================
-- 6. WORK UPDATES TABLE
-- ============================================

-- Check work_updates table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'work_updates'
ORDER BY ordinal_position;

-- Get work updates for a maintenance request
SELECT 
  wu.id,
  wu.request_id,
  wu.vendor_id,
  wu.update_type,
  wu.description,
  wu.images,
  wu.created_at,
  v.full_name as vendor_name
FROM work_updates wu
LEFT JOIN profiles v ON wu.vendor_id = v.id
WHERE wu.request_id = 'REQUEST_ID'
ORDER BY wu.created_at DESC;

-- ============================================
-- 7. COMPLETE REQUEST WITH ALL RELATIONS
-- ============================================

-- Get complete maintenance request data
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
  
  -- Property
  p.title as property_title,
  p.address as property_address,
  
  -- Owner
  o.full_name as owner_name,
  o.phone as owner_phone,
  
  -- Tenant
  t.full_name as tenant_name,
  t.phone as tenant_phone,
  
  -- Category
  sc.name as category_name,
  
  -- Selected Vendor
  sv.full_name as vendor_name,
  sv.phone as vendor_phone,
  
  -- Counts
  (SELECT COUNT(*) FROM quotes WHERE request_id = mr.id) as quote_count,
  (SELECT COUNT(*) FROM quotes WHERE request_id = mr.id AND status = 'submitted') as pending_quotes,
  (SELECT COUNT(*) FROM messages WHERE topic = 'maintenance_' || mr.id::text) as message_count,
  (SELECT COUNT(*) FROM messages WHERE topic = 'maintenance_' || mr.id::text AND read_at IS NULL AND recipient_id = mr.owner_id) as unread_messages,
  
  -- Latest message
  (SELECT content FROM messages WHERE topic = 'maintenance_' || mr.id::text ORDER BY created_at DESC LIMIT 1) as last_message,
  (SELECT created_at FROM messages WHERE topic = 'maintenance_' || mr.id::text ORDER BY created_at DESC LIMIT 1) as last_message_at
  
FROM maintenance_requests mr
LEFT JOIN properties p ON mr.property_id = p.id
LEFT JOIN profiles o ON mr.owner_id = o.id
LEFT JOIN profiles t ON mr.tenant_id = t.id
LEFT JOIN service_categories sc ON mr.category_id = sc.id
LEFT JOIN profiles sv ON mr.selected_vendor_id = sv.id
WHERE mr.id = 'REQUEST_ID';

-- ============================================
-- 8. CHAT CONVERSATION STRUCTURE
-- ============================================

-- Get chat conversation for a maintenance request
-- Topic format: 'maintenance_REQUEST_ID'
SELECT 
  m.id,
  m.sender_id,
  m.recipient_id,
  m.content,
  m.message_type,
  m.attachments,
  m.read_at,
  m.created_at,
  sender.full_name as sender_name,
  sender.avatar_url as sender_avatar,
  sender.role as sender_role,
  recipient.full_name as recipient_name,
  recipient.role as recipient_role,
  CASE 
    WHEN m.sender_id = 'CURRENT_USER_ID' THEN true 
    ELSE false 
  END as is_mine
FROM messages m
LEFT JOIN profiles sender ON m.sender_id = sender.id
LEFT JOIN profiles recipient ON m.recipient_id = recipient.id
WHERE m.topic = 'maintenance_REQUEST_ID'
ORDER BY m.created_at ASC;

-- Mark messages as read
-- UPDATE messages 
-- SET read_at = NOW()
-- WHERE topic = 'maintenance_REQUEST_ID'
--   AND recipient_id = 'CURRENT_USER_ID'
--   AND read_at IS NULL;

-- ============================================
-- 9. STATISTICS FOR DASHBOARD
-- ============================================

-- Get maintenance request statistics
SELECT 
  COUNT(*) as total_requests,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as open_requests,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
  COUNT(CASE WHEN po_id IS NOT NULL THEN 1 END) as requests_with_po,
  COUNT(CASE WHEN selected_quote_id IS NOT NULL THEN 1 END) as requests_with_accepted_quote,
  SUM(CASE WHEN status = 'completed' THEN actual_cost ELSE 0 END) as total_spent
FROM maintenance_requests
WHERE owner_id = 'OWNER_ID';

-- Get quote statistics
SELECT 
  COUNT(*) as total_quotes,
  COUNT(CASE WHEN status = 'submitted' THEN 1 END) as pending_quotes,
  COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_quotes,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_quotes,
  AVG(total_amount) as average_quote_amount
FROM quotes q
JOIN maintenance_requests mr ON q.request_id = mr.id
WHERE mr.owner_id = 'OWNER_ID';

-- ============================================
-- 10. REAL-TIME SUBSCRIPTION QUERIES
-- ============================================

-- Subscribe to new messages for a request
-- SELECT * FROM messages 
-- WHERE topic = 'maintenance_REQUEST_ID'
-- ORDER BY created_at DESC;

-- Subscribe to quote updates for a request
-- SELECT * FROM quotes 
-- WHERE request_id = 'REQUEST_ID'
-- ORDER BY submitted_at DESC;

-- Subscribe to request status changes
-- SELECT * FROM maintenance_requests 
-- WHERE id = 'REQUEST_ID';
