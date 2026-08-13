-- Migration 061: Fix messaging RLS infinite recursion (42P17) — SECURITY DEFINER helpers
--
-- PROBLEM (proven live after applying 060): PostgreSQL rejected every read with
--   "infinite recursion detected in policy for relation message_threads/messages"
-- The message_threads SELECT policy references `messages`, whose SELECT policy
-- references `message_threads` back -> the planner detects a cycle and refuses.
-- 043/057/058 shipped this cross-referencing design but it was NEVER exercised
-- because RLS was disabled on live (the exact risk SA flagged).
--
-- FIX: move every cross-table check into SECURITY DEFINER helper functions.
-- SECURITY DEFINER functions bypass RLS internally (run as the function owner),
-- so the policies themselves only call functions and the cycle disappears.
-- The functions re-implement the SAME access rules, so security is unchanged:
--   - is_thread_participant(thread)   -> owner / tenant / vendor-with-a-message
--   - can_view_message(msg)           -> participant full history (owner/tenant)
--                                        OR vendor join-window (first vendor msg onward)
--   - can_send_message(thread,sender,role) -> owner/tenant participant OR vendor
--                                        reply OR narrowed maintenance bootstrap (058)
-- The INSERT policy additionally enforces sender_id = auth.uid() at row level.
-- Idempotent: drops all era policy names, drops/recreates functions.

-- ── 1. Drop ALL existing messaging policies (any era) ───────────────────────
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

-- ── 2. Helper functions (SECURITY DEFINER — break the policy cycle) ─────────
DROP FUNCTION IF EXISTS public.is_thread_participant(uuid);
CREATE FUNCTION public.is_thread_participant(p_thread uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM message_threads t
      WHERE t.id = p_thread
        AND (t.owner_id = auth.uid() OR t.tenant_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM messages m
      WHERE m.thread_id = p_thread AND m.sender_id = auth.uid()
    )
$$;

DROP FUNCTION IF EXISTS public.can_view_message(uuid);
CREATE FUNCTION public.can_view_message(p_msg uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM message_threads t
    JOIN messages m ON m.thread_id = t.id
    WHERE m.id = p_msg
      AND (
        -- owner / tenant: full thread history
        (t.owner_id = auth.uid() OR t.tenant_id = auth.uid())
        OR
        -- vendor: only from their first message in the thread onward (no read-escalation)
        (
          EXISTS (
            SELECT 1 FROM messages mine
            WHERE mine.thread_id = m.thread_id AND mine.sender_id = auth.uid()
          )
          AND m.created_at >= (
            SELECT MIN(m2.created_at) FROM messages m2
            WHERE m2.thread_id = m.thread_id AND m2.sender_id = auth.uid()
          )
        )
      )
  )
$$;

DROP FUNCTION IF EXISTS public.can_send_message(uuid, uuid, text);
CREATE FUNCTION public.can_send_message(p_thread uuid, p_sender uuid, p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- owner / tenant participant
    EXISTS (
      SELECT 1 FROM message_threads t
      WHERE t.id = p_thread
        AND (t.owner_id = p_sender OR t.tenant_id = p_sender)
    )
    OR
    -- vendor reply (already participated)
    (
      p_role = 'vendor'
      AND EXISTS (
        SELECT 1 FROM messages m
        WHERE m.thread_id = p_thread AND m.sender_id = p_sender
      )
    )
    OR
    -- vendor bootstrap: ACTIVE maintenance assignment on the thread's property,
    -- AND thread is a maintenance-category thread (narrowed per 058)
    (
      p_role = 'vendor'
      AND EXISTS (
        SELECT 1 FROM message_threads t
        JOIN maintenance_requests mr ON mr.property_id = t.property_id
        WHERE t.id = p_thread
          AND t.category = 'maintenance'
          AND mr.status NOT IN ('completed', 'closed')
          AND (mr.selected_vendor_id = p_sender OR mr.vendor_id = p_sender)
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.is_thread_participant(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_message(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_message(uuid, uuid, text) TO authenticated;
-- Defense-in-depth: these accept arbitrary ids; only authenticated role may call.
REVOKE EXECUTE ON FUNCTION public.is_thread_participant(uuid)      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_view_message(uuid)           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_send_message(uuid, uuid, text) FROM PUBLIC;

-- ── 2b. RLS enabled (standalone-safety; idempotent with 060) ────────────────
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- ── 3. Policies — function-only expressions, no cross-table cycles ──────────

-- message_threads
CREATE POLICY "Participants can view their own threads"
ON message_threads FOR SELECT TO authenticated
USING (public.is_thread_participant(id));

CREATE POLICY "Participants can create threads"
ON message_threads FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id OR auth.uid() = tenant_id);

CREATE POLICY "Participants can update their threads"
ON message_threads FOR UPDATE TO authenticated
USING (public.is_thread_participant(id));

-- messages
CREATE POLICY "Thread participants can view messages"
ON messages FOR SELECT TO authenticated
USING (public.can_view_message(id));

CREATE POLICY "Thread participants can send messages"
ON messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.can_send_message(thread_id, sender_id, sender_role)
);

CREATE POLICY "Thread participants can update messages"
ON messages FOR UPDATE TO authenticated
USING (public.can_view_message(id));

-- message_attachments
CREATE POLICY "Thread participants can view attachments"
ON message_attachments FOR SELECT TO authenticated
USING (public.can_view_message(message_id));

CREATE POLICY "Message senders can add attachments"
ON message_attachments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = message_attachments.message_id
      AND messages.sender_id = auth.uid()
  )
);

-- ── 4. Comments ─────────────────────────────────────────────────────────────
COMMENT ON TABLE message_threads IS 'Message threads. RLS: owner/tenant participants + vendors who have a message in the thread. (ENFORCED LIVE — 060/061)';
COMMENT ON TABLE messages IS 'Individual messages. RLS: thread participants (owner/tenant) + vendor join-window. (ENFORCED LIVE — 060/061)';
COMMENT ON TABLE message_attachments IS 'File attachments on messages. RLS: thread participants + vendor join-window. (ENFORCED LIVE — 060/061)';
