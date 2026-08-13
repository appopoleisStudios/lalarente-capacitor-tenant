-- Migration 060: ENFORCE messaging RLS on the LIVE database (SEC issue N2)
--
-- PROVEN LIVE: message_threads and messages had RLS DISABLED on production —
-- an unauthenticated (anon) request could read every thread and message. The
-- earlier RLS migrations (043 owner/tenant, 057/058 vendor) were never applied
-- to the live DB. This migration is SELF-CONTAINED and IDEMPOTENT: it enables
-- RLS, drops every policy that may or may not exist (043/057/058-era names),
-- and recreates the complete hardened policy set.
--
-- NOTE: the policy bodies below are FUNCTIONALLY REPLACED by migrations
-- 061 (SECURITY DEFINER helpers — fixes the 42P17 cross-table recursion the
-- planner rejects once RLS is actually enforced) and 062 (row-argument
-- can_view_thread_message — fixes INSERT...RETURNING 42501 for the app's
-- .insert().select() pattern). 060 ships as the self-contained baseline;
-- 061/062 must be applied immediately after (they are in the same PR).
--
-- Policy set (equivalent to 043 + 057 + 058):
--   message_threads  SELECT  -> owner / tenant / vendor-with-a-message
--   message_threads  INSERT  -> owner or tenant creating the thread
--   message_threads  UPDATE  -> owner / tenant / vendor-with-a-message
--   messages         SELECT  -> thread participant (owner/tenant) OR vendor
--                                join-the-conversation window (first vendor
--                                message onward — no read-escalation)
--   messages         INSERT  -> sender + thread participant, OR vendor reply /
--                                narrowed maintenance-bootstrap (058)
--   messages         UPDATE  -> thread participant OR vendor window
--   message_attachments SELECT -> participant / vendor window
--   message_attachments INSERT -> the message sender

-- ── 0. sender_role CHECK: allow 'vendor' (migration 057 requirement) ────────
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_role_check;
ALTER TABLE messages
  ADD CONSTRAINT messages_sender_role_check
  CHECK (sender_role IN ('owner', 'tenant', 'vendor'));

-- ── 1. Enable RLS (idempotent) ──────────────────────────────────────────────
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- ── 2. Drop ALL existing policies (any era) ─────────────────────────────────
DROP POLICY IF EXISTS "Participants can view their own threads"      ON message_threads;
DROP POLICY IF EXISTS "Participants can create threads"              ON message_threads;
DROP POLICY IF EXISTS "Participants can update their threads"        ON message_threads;
DROP POLICY IF EXISTS "Vendor participants can view threads"         ON message_threads;

DROP POLICY IF EXISTS "Thread participants can view messages"        ON messages;
DROP POLICY IF EXISTS "Thread participants can send messages"        ON messages;
DROP POLICY IF EXISTS "Thread participants can update messages"      ON messages;
DROP POLICY IF EXISTS "Vendor participants can view messages"        ON messages;
DROP POLICY IF EXISTS "Vendor participants can send messages"        ON messages;
DROP POLICY IF EXISTS "Vendor participants can update messages"      ON messages;

DROP POLICY IF EXISTS "Thread participants can view attachments"     ON message_attachments;
DROP POLICY IF EXISTS "Message senders can add attachments"          ON message_attachments;
DROP POLICY IF EXISTS "Vendor participants can view attachments"     ON message_attachments;

-- ── 3. message_threads policies ─────────────────────────────────────────────

-- SELECT: owner / tenant / any vendor who already has a message in the thread
CREATE POLICY "Participants can view their own threads"
ON message_threads FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id OR
  auth.uid() = tenant_id OR
  EXISTS (
    SELECT 1 FROM messages m
    WHERE m.thread_id = message_threads.id
      AND m.sender_id = auth.uid()
  )
);

-- INSERT: only the owner or tenant of the thread can create it
CREATE POLICY "Participants can create threads"
ON message_threads FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id OR
  auth.uid() = tenant_id
);

-- UPDATE: participants can update thread status (archive, reopen, etc.)
CREATE POLICY "Participants can update their threads"
ON message_threads FOR UPDATE
TO authenticated
USING (
  auth.uid() = owner_id OR
  auth.uid() = tenant_id OR
  EXISTS (
    SELECT 1 FROM messages m
    WHERE m.thread_id = message_threads.id
      AND m.sender_id = auth.uid()
  )
);

-- ── 4. messages policies ────────────────────────────────────────────────────

-- SELECT: thread participants (owner/tenant) OR vendor join-window
CREATE POLICY "Thread participants can view messages"
ON messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM message_threads
    WHERE message_threads.id = messages.thread_id
      AND (message_threads.owner_id = auth.uid() OR message_threads.tenant_id = auth.uid())
  )
  OR (
    -- vendor: only from their first message in the thread onward (no read-escalation)
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
  )
);

-- INSERT: sender + participant, OR vendor reply / narrowed maintenance bootstrap
CREATE POLICY "Thread participants can send messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    -- owner/tenant participant
    EXISTS (
      SELECT 1 FROM message_threads
      WHERE message_threads.id = messages.thread_id
        AND (message_threads.owner_id = auth.uid() OR message_threads.tenant_id = auth.uid())
    )
    OR
    -- vendor reply (already participated)
    (
      sender_role = 'vendor'
      AND EXISTS (
        SELECT 1 FROM messages m
        WHERE m.thread_id = messages.thread_id
          AND m.sender_id = auth.uid()
      )
    )
    OR
    -- vendor bootstrap: ACTIVE maintenance assignment on the thread's property,
    -- AND thread is a maintenance-category thread (narrowed per 058)
    (
      sender_role = 'vendor'
      AND EXISTS (
        SELECT 1 FROM message_threads t
        JOIN maintenance_requests mr ON mr.property_id = t.property_id
        WHERE t.id = messages.thread_id
          AND t.category = 'maintenance'
          AND mr.status NOT IN ('completed', 'closed')
          AND (mr.selected_vendor_id = auth.uid() OR mr.vendor_id = auth.uid())
      )
    )
  )
);

-- UPDATE (mark as read): thread participants OR vendor join-window
CREATE POLICY "Thread participants can update messages"
ON messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM message_threads
    WHERE message_threads.id = messages.thread_id
      AND (message_threads.owner_id = auth.uid() OR message_threads.tenant_id = auth.uid())
  )
  OR (
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
  )
);

-- ── 5. message_attachments policies ─────────────────────────────────────────

-- SELECT: thread participants OR vendor join-window
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
  OR EXISTS (
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

-- INSERT: only the sender of the message can attach files to it
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

-- ── 6. Comments ─────────────────────────────────────────────────────────────
COMMENT ON TABLE message_threads IS 'Message threads. RLS: owner/tenant participants + vendors who have a message in the thread. (ENFORCED LIVE — migration 060)';
COMMENT ON TABLE messages IS 'Individual messages. RLS: thread participants (owner/tenant) + vendor join-window. (ENFORCED LIVE — migration 060)';
COMMENT ON TABLE message_attachments IS 'File attachments on messages. RLS: thread participants + vendor join-window. (ENFORCED LIVE — migration 060)';
