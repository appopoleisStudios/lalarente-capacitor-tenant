-- Migration 058: Narrow vendor message INSERT bootstrap to maintenance threads (Plane #70)
--
-- SA REQUEST CHANGES on #129: migration 057's INSERT bootstrap policy let an
-- assigned vendor join ANY message_threads row on the property for which they
-- hold a maintenance assignment — including 'lease' / 'payment' / 'general' /
-- 'emergency' category threads. The join-window SELECT blocks reading history,
-- but not inject-then-read-forward into unrelated conversations.
--
-- Narrow the bootstrap to:
--   1. t.category = 'maintenance'  — tenant maintenance threads are created
--      with category 'maintenance' (see messagesApi.getOrCreateThread callers
--      in TenantMaintenanceList/DetailScreen: "Maintenance: {title}",
--      category 'maintenance'). Lease/payment/general threads are off-limits.
--   2. mr.status NOT IN ('completed','closed')  — only an ACTIVE assignment can
--      bootstrap a vendor into a thread. Terminal requests (completed/closed)
--      cannot be joined, so a finished job can't resurrect conversation access.
--
-- Idempotent: drops and recreates the policy it owns (057 is already live).

-- ── Replace messages INSERT bootstrap with the narrowed version ────────────
DROP POLICY IF EXISTS "Vendor participants can send messages" ON messages;
CREATE POLICY "Vendor participants can send messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND sender_role = 'vendor'
  AND (
    -- already participated (reply)
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.thread_id = messages.thread_id
        AND m.sender_id = auth.uid()
    )
    OR
    -- assigned to an ACTIVE maintenance request on the thread's property,
    -- AND the thread is a maintenance-category thread (bootstrap)
    EXISTS (
      SELECT 1 FROM message_threads t
      JOIN maintenance_requests mr ON mr.property_id = t.property_id
      WHERE t.id = messages.thread_id
        AND t.category = 'maintenance'
        AND mr.status NOT IN ('completed', 'closed')
        AND (mr.selected_vendor_id = auth.uid() OR mr.vendor_id = auth.uid())
    )
  )
);

COMMENT ON POLICY "Vendor participants can send messages" ON messages
IS 'Vendor replies require prior participation. Bootstrap is limited to maintenance-category threads on the vendor''s ACTIVE (non-terminal) maintenance assignment.';
