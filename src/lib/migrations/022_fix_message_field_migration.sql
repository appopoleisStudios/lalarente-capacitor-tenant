-- Fix Message Field Migration
-- This migration fixes existing messages that were stored with wrong field name

-- Update messages where content is null/empty but message field has data
UPDATE public.messages 
SET content = message 
WHERE (content IS NULL OR content = '') 
  AND message IS NOT NULL 
  AND message != '';

-- Log the fix for audit purposes
INSERT INTO public.contract_management_audit_logs (
  contract_id,
  event_type,
  event_description,
  actor_id,
  old_values,
  new_values,
  created_at
) VALUES (
  NULL, -- No specific contract for this system fix
  'system_fix',
  'Fixed message field migration: Moved data from message field to content field',
  NULL, -- System actor
  '{"affected_messages": "Messages with message field populated but content field empty"}',
  '{"fix_applied": "Data moved from message to content field"}',
  NOW()
);

-- Verify the fix
-- This will show how many messages were affected
SELECT 
  COUNT(*) as messages_fixed,
  COUNT(CASE WHEN content IS NOT NULL AND content != '' THEN 1 END) as messages_with_content,
  COUNT(CASE WHEN message IS NOT NULL AND message != '' THEN 1 END) as messages_with_old_field
FROM public.messages;
