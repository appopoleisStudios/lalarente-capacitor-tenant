-- Allow authenticated users to create message_threads where they are a party
-- (owner_id = auth.uid() OR tenant_id = auth.uid()).
-- UAT caught: tenant Send → "new row violates row-level security policy for
-- table message_threads". Thread creation path was blocked at RLS.

-- Enable RLS (idempotent)
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;

-- INSERT: caller must be either the owner or tenant on the row they're creating
DROP POLICY IF EXISTS message_threads_insert_party ON public.message_threads;
CREATE POLICY message_threads_insert_party ON public.message_threads
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() OR tenant_id = auth.uid());

-- SELECT: caller must be a party to the thread (idempotent re-create to be safe)
DROP POLICY IF EXISTS message_threads_select_party ON public.message_threads;
CREATE POLICY message_threads_select_party ON public.message_threads
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR tenant_id = auth.uid());

-- UPDATE: caller must remain a party (used for marking read, status changes)
DROP POLICY IF EXISTS message_threads_update_party ON public.message_threads;
CREATE POLICY message_threads_update_party ON public.message_threads
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR tenant_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() OR tenant_id = auth.uid());

-- messages table also needs INSERT policy for sender
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_insert_sender ON public.messages;
CREATE POLICY messages_insert_sender ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM message_threads t
      WHERE t.id = thread_id
        AND (t.owner_id = auth.uid() OR t.tenant_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS messages_select_party ON public.messages;
CREATE POLICY messages_select_party ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM message_threads t
      WHERE t.id = thread_id
        AND (t.owner_id = auth.uid() OR t.tenant_id = auth.uid())
    )
  );
