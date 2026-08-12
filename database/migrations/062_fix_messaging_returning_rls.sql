-- Migration 062: Fix INSERT ... RETURNING RLS rejection (42501) on `messages`
--
-- PROBLEM (proven live after 060/061): every `INSERT INTO messages ... RETURNING`
-- was rejected with 42501 "new row violates row-level security policy", for ALL
-- roles (owner, tenant, vendor) — while a plain INSERT (no RETURNING) succeeded.
--
-- Root cause: PostgREST `Prefer: return=representation` (used by the app's
-- `.insert().select().single()`) makes Postgres evaluate the SELECT policy on
-- the RETURNING row. The SELECT policy called `can_view_message(message_id)`,
-- whose SECURITY DEFINER body reads `messages` — and within the same INSERT
-- statement the just-inserted row is NOT visible to that subquery (statement
-- snapshot predates the insert). So the policy could never authorize the row it
-- was asked to return, regardless of the user's actual access. 061's cycle fix
-- was necessary but not sufficient.
--
-- FIX: evaluate the messages SELECT/UPDATE policy from the ROW'S OWN column
-- values (thread_id, sender_id, created_at) passed as function arguments — no
-- self-lookup on `messages.id` is needed. Semantics are unchanged:
--   - owner/tenant of the thread  -> full thread history
--   - the sender (own message)    -> always visible (this is what makes
--     INSERT...RETURNING pass for the inserting user)
--   - vendor participant          -> messages at-or-after their first vendor
--     message in the thread (no read-escalation); equivalent to 061's window.
-- Anon/non-participants: auth.uid() is NULL / no thread / no window -> 0 rows.
-- Idempotent: drops/recreates its policies + function.

-- ── 1. New row-argument access function (SECURITY DEFINER — no RLS, no cycle) ─
DROP FUNCTION IF EXISTS public.can_view_thread_message(uuid, uuid, timestamptz);
CREATE FUNCTION public.can_view_thread_message(p_thread uuid, p_sender uuid, p_created_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- owner / tenant of the thread: full history
    EXISTS (
      SELECT 1 FROM message_threads t
      WHERE t.id = p_thread
        AND (t.owner_id = auth.uid() OR t.tenant_id = auth.uid())
    )
    OR
    -- the sender can always see their own message (covers INSERT...RETURNING)
    p_sender = auth.uid()
    OR
    -- vendor participant: only messages from their first vendor message onward
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.thread_id = p_thread
        AND m.sender_id = auth.uid()
        AND m.created_at <= p_created_at
    )
$$;

GRANT EXECUTE ON FUNCTION public.can_view_thread_message(uuid, uuid, timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_view_thread_message(uuid, uuid, timestamptz) FROM PUBLIC;

-- ── 2. Rewrite messages SELECT + UPDATE policies ────────────────────────────
DROP POLICY IF EXISTS "Thread participants can view messages" ON messages;
DROP POLICY IF EXISTS "Thread participants can update messages" ON messages;

CREATE POLICY "Thread participants can view messages"
ON messages FOR SELECT TO authenticated
USING (public.can_view_thread_message(thread_id, sender_id, created_at));

CREATE POLICY "Thread participants can update messages"
ON messages FOR UPDATE TO authenticated
USING (public.can_view_thread_message(thread_id, sender_id, created_at));

-- ── 3. Attachments SELECT keeps the id-based check (attachments reference
--    already-committed messages, so the lookup is safe there) ───────────────
-- (no change needed; "Thread participants can view attachments" still uses
--  can_view_message(message_id))

COMMENT ON TABLE messages IS 'Individual messages. RLS: owner/tenant full thread history + sender always visible + vendor join-window (row-arg policy, 062). (ENFORCED LIVE — 060/061/062)';
