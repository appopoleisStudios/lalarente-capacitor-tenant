-- Migration 043: Fix messaging RLS — restrict thread read access (N2)
-- Only thread participants (owner + tenant) can read their own messages
-- Run this in Supabase SQL Editor or via: npx supabase db push

-- ── 1. Enable RLS on all message tables ──────────────────────
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- ── 2. Message Threads RLS ───────────────────────────────────

-- SELECT: only the owner or tenant of a thread can view it
CREATE POLICY "Participants can view their own threads"
ON message_threads FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id OR
  auth.uid() = tenant_id
);

-- INSERT: users can only create threads where they are the owner or tenant
CREATE POLICY "Participants can create threads"
ON message_threads FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id OR
  auth.uid() = tenant_id
);

-- UPDATE: only participants can update thread status (archive, reopen, etc.)
CREATE POLICY "Participants can update their threads"
ON message_threads FOR UPDATE
TO authenticated
USING (
  auth.uid() = owner_id OR
  auth.uid() = tenant_id
);

-- ── 3. Messages RLS ──────────────────────────────────────────

-- SELECT: only participants of the thread can view its messages
CREATE POLICY "Thread participants can view messages"
ON messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM message_threads
    WHERE message_threads.id = messages.thread_id
      AND (message_threads.owner_id = auth.uid() OR message_threads.tenant_id = auth.uid())
  )
);

-- INSERT: thread participants can send messages (sender_id must match auth.uid())
CREATE POLICY "Thread participants can send messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM message_threads
    WHERE message_threads.id = messages.thread_id
      AND (message_threads.owner_id = auth.uid() OR message_threads.tenant_id = auth.uid())
  )
);

-- UPDATE: thread participants can mark messages as read (read_at timestamp)
-- The only UPDATE operation in the codebase is markAsRead, which updates messages
-- from the other party — so the policy must allow thread participants, not just the sender
CREATE POLICY "Thread participants can update messages"
ON messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM message_threads
    WHERE message_threads.id = messages.thread_id
      AND (message_threads.owner_id = auth.uid() OR message_threads.tenant_id = auth.uid())
  )
);

-- ── 4. Message Attachments RLS ───────────────────────────────

-- SELECT: thread participants can view attachments
CREATE POLICY "Thread participants can view attachments"
ON message_attachments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM messages
    JOIN message_threads ON message_threads.id = messages.thread_id
    WHERE messages.id = message_attachments.message_id
      AND (message_threads.owner_id = auth.uid() OR message_threads.tenant_id = auth.uid())
  )
);

-- INSERT: only the sender of the message can add attachments to it
CREATE POLICY "Message senders can add attachments"
ON message_attachments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = message_attachments.message_id
      AND messages.sender_id = auth.uid()
  )
);

-- ── 5. Comments ──────────────────────────────────────────────

COMMENT ON TABLE message_threads IS 'Message threads between owners and tenants. RLS enforced: participants only.';
COMMENT ON TABLE messages IS 'Individual messages within a thread. RLS enforced: thread participants only.';
COMMENT ON TABLE message_attachments IS 'File attachments on messages. RLS enforced: thread participants only.';
