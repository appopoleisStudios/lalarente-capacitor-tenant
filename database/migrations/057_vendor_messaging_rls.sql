-- Migration 057: Vendor messaging participation — RLS + sender_role CHECK (Plane #70)
--
-- Vendor messaging routes existed but were dead ends:
--   1. messages.sender_role CHECK (migration 009) only allowed ('owner','tenant')
--   2. migration 043 RLS only let owner_id/tenant_id read threads + messages,
--      send messages, or mark them read.
--
-- A vendor "participates" in a thread once they have a message in it
-- (sender_role='vendor'). Vendors can also bootstrap into a thread for a
-- property where they're the assigned vendor (maintenance_requests
-- selected_vendor_id OR vendor_id) — the "vendor messages owner about a job"
-- flow. Policies are additive (Postgres ORs them with existing ones), so
-- existing owner/tenant access is untouched.

-- ── 1. sender_role CHECK: allow 'vendor' ──────────────────────────────────
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_role_check;
ALTER TABLE messages
  ADD CONSTRAINT messages_sender_role_check
  CHECK (sender_role IN ('owner', 'tenant', 'vendor'));

-- ── 2. Thread SELECT: vendor participants ─────────────────────────────────
DROP POLICY IF EXISTS "Vendor participants can view threads" ON message_threads;
CREATE POLICY "Vendor participants can view threads"
ON message_threads FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM messages m
    WHERE m.thread_id = message_threads.id
      AND m.sender_id = auth.uid()
  )
);

-- ── 3. Messages SELECT: vendor participants ───────────────────────────────
-- Join-the-conversation window: the vendor only sees messages from their FIRST
-- message in the thread onward. This prevents a read-escalation path where a
-- vendor assigned to a property could inject one message into a property thread
-- and then read the ENTIRE prior owner/tenant private history.
DROP POLICY IF EXISTS "Vendor participants can view messages" ON messages;
CREATE POLICY "Vendor participants can view messages"
ON messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM messages m
    WHERE m.thread_id = messages.thread_id
      AND m.sender_id = auth.uid()
  )
  AND messages.created_at >= (
    SELECT MIN(m2.created_at)
    FROM messages m2
    WHERE m2.thread_id = messages.thread_id
      AND m2.sender_id = auth.uid()
  )
);

-- ── 4. Messages INSERT: vendor participants (replies) + assigned-work bootstrap ──
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
    -- assigned to a maintenance request on the thread's property (bootstrap)
    EXISTS (
      SELECT 1 FROM message_threads t
      JOIN maintenance_requests mr ON mr.property_id = t.property_id
      WHERE t.id = messages.thread_id
        AND (mr.selected_vendor_id = auth.uid() OR mr.vendor_id = auth.uid())
    )
  )
);

-- ── 5. Messages UPDATE (mark as read): vendor participants ────────────────
-- Same join-the-conversation window as SELECT — a vendor can only mark messages
-- read that they are allowed to see (from their first message onward).
DROP POLICY IF EXISTS "Vendor participants can update messages" ON messages;
CREATE POLICY "Vendor participants can update messages"
ON messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM messages m
    WHERE m.thread_id = messages.thread_id
      AND m.sender_id = auth.uid()
  )
  AND messages.created_at >= (
    SELECT MIN(m2.created_at)
    FROM messages m2
    WHERE m2.thread_id = messages.thread_id
      AND m2.sender_id = auth.uid()
  )
);

-- ── 6. Attachments SELECT: vendor participants ────────────────────────────
-- Same join-the-conversation window as messages SELECT.
DROP POLICY IF EXISTS "Vendor participants can view attachments" ON message_attachments;
CREATE POLICY "Vendor participants can view attachments"
ON message_attachments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = message_attachments.message_id
      AND EXISTS (
        SELECT 1 FROM messages mine
        WHERE mine.thread_id = m.thread_id
          AND mine.sender_id = auth.uid()
      )
      AND m.created_at >= (
        SELECT MIN(m2.created_at)
        FROM messages m2
        WHERE m2.thread_id = m.thread_id
          AND m2.sender_id = auth.uid()
      )
  )
);

COMMENT ON TABLE message_threads IS 'Message threads. RLS: owner/tenant participants + vendors who have a message in the thread.';
COMMENT ON TABLE messages IS 'Individual messages within a thread. RLS: thread participants (owner/tenant) + vendor participants.';
COMMENT ON TABLE message_attachments IS 'File attachments on messages. RLS: thread participants + vendor participants.';
