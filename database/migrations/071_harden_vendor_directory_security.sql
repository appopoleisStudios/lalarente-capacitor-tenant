-- Migration 071: SA remediation for vendor directory aggregates and private contact
--
-- 1. Vendor phone numbers leave the broadly-readable profiles table.
-- 2. Completed-job counts include both completed and closed terminal states.
-- 3. Rating reassignment refreshes both the old and new vendor aggregates.
-- 4. Assigned vendors can atomically bootstrap the maintenance thread used by
--    invoice talk without widening message/thread RLS.

-- ── 1. Keep vendor phone numbers in a vendor-self-only table ────────────────
CREATE TABLE IF NOT EXISTS public.vendor_private_contacts (
  vendor_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vendor_private_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_private_contacts_self_select
  ON public.vendor_private_contacts;
CREATE POLICY vendor_private_contacts_self_select
  ON public.vendor_private_contacts
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = vendor_id);

DROP POLICY IF EXISTS vendor_private_contacts_self_insert
  ON public.vendor_private_contacts;
CREATE POLICY vendor_private_contacts_self_insert
  ON public.vendor_private_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = vendor_id);

DROP POLICY IF EXISTS vendor_private_contacts_self_update
  ON public.vendor_private_contacts;
CREATE POLICY vendor_private_contacts_self_update
  ON public.vendor_private_contacts
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = vendor_id)
  WITH CHECK ((SELECT auth.uid()) = vendor_id);

REVOKE ALL ON TABLE public.vendor_private_contacts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.vendor_private_contacts TO authenticated;

INSERT INTO public.vendor_private_contacts (vendor_id, phone)
SELECT id, phone
FROM public.profiles
WHERE role = 'vendor'
  AND phone IS NOT NULL
ON CONFLICT (vendor_id) DO UPDATE
SET phone = EXCLUDED.phone,
    updated_at = NOW();

UPDATE public.profiles
SET phone = NULL
WHERE role = 'vendor'
  AND phone IS NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_vendor_phone_private;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_vendor_phone_private
  CHECK (role <> 'vendor' OR phone IS NULL);

COMMENT ON TABLE public.vendor_private_contacts IS
  'Vendor-self-only contact data. Owner/tenant vendor discovery must use public profile fields and in-app messaging.';

-- ── 2. Count completed and closed jobs without double-transitioning ─────────
UPDATE public.profiles AS profile
SET completed_jobs = (
  SELECT COUNT(*)::INTEGER
  FROM public.maintenance_requests AS request
  WHERE request.selected_vendor_id = profile.id
    AND request.status IN ('completed', 'closed')
)
WHERE profile.role = 'vendor';

CREATE OR REPLACE FUNCTION public.sync_vendor_completed_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.selected_vendor_id IS NOT NULL
       AND OLD.status IN ('completed', 'closed') THEN
      UPDATE public.profiles
      SET completed_jobs = GREATEST(completed_jobs - 1, 0)
      WHERE id = OLD.selected_vendor_id
        AND role = 'vendor';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.selected_vendor_id IS NOT NULL
       AND NEW.status IN ('completed', 'closed') THEN
      UPDATE public.profiles
      SET completed_jobs = completed_jobs + 1
      WHERE id = NEW.selected_vendor_id
        AND role = 'vendor';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.selected_vendor_id IS NOT NULL
     AND OLD.status IN ('completed', 'closed')
     AND (
       NEW.selected_vendor_id IS DISTINCT FROM OLD.selected_vendor_id
       OR NEW.status NOT IN ('completed', 'closed')
     ) THEN
    UPDATE public.profiles
    SET completed_jobs = GREATEST(completed_jobs - 1, 0)
    WHERE id = OLD.selected_vendor_id
      AND role = 'vendor';
  END IF;

  IF NEW.selected_vendor_id IS NOT NULL
     AND NEW.status IN ('completed', 'closed')
     AND (
       OLD.selected_vendor_id IS DISTINCT FROM NEW.selected_vendor_id
       OR OLD.status NOT IN ('completed', 'closed')
     ) THEN
    UPDATE public.profiles
    SET completed_jobs = completed_jobs + 1
    WHERE id = NEW.selected_vendor_id
      AND role = 'vendor';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_vendor_completed_jobs()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_vendor_completed_jobs
  ON public.maintenance_requests;
CREATE TRIGGER trg_sync_vendor_completed_jobs
  AFTER INSERT OR UPDATE OR DELETE
  ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_vendor_completed_jobs();

COMMENT ON COLUMN public.profiles.completed_jobs IS
  'Count of terminal maintenance requests assigned to this vendor with status completed or closed.';

-- ── 3. Recompute rating for every vendor affected by a row change ───────────
CREATE OR REPLACE FUNCTION public.update_vendor_rating_average()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE public.profiles
    SET rating = (
      SELECT ROUND(AVG(overall_rating)::NUMERIC, 2)
      FROM public.vendor_ratings
      WHERE vendor_id = OLD.vendor_id
        AND overall_rating IS NOT NULL
    )
    WHERE id = OLD.vendor_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE')
     AND (
       TG_OP = 'INSERT'
       OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id
       OR NEW.overall_rating IS DISTINCT FROM OLD.overall_rating
     ) THEN
    UPDATE public.profiles
    SET rating = (
      SELECT ROUND(AVG(overall_rating)::NUMERIC, 2)
      FROM public.vendor_ratings
      WHERE vendor_id = NEW.vendor_id
        AND overall_rating IS NOT NULL
    )
    WHERE id = NEW.vendor_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.update_vendor_rating_average()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_vendor_rating_avg ON public.vendor_ratings;
CREATE TRIGGER trg_vendor_rating_avg
  AFTER INSERT OR UPDATE OR DELETE
  ON public.vendor_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vendor_rating_average();

-- ── 4. Atomic vendor first-contact for a maintenance/invoice thread ─────────
CREATE OR REPLACE FUNCTION public.bootstrap_vendor_maintenance_thread(
  p_request_id UUID,
  p_initial_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_request public.maintenance_requests%ROWTYPE;
  v_thread_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NULLIF(BTRIM(p_initial_message), '') IS NULL THEN
    RAISE EXCEPTION 'Initial message is required';
  END IF;

  SELECT *
  INTO v_request
  FROM public.maintenance_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Maintenance request not found';
  END IF;

  IF v_request.selected_vendor_id IS DISTINCT FROM v_actor
     AND v_request.vendor_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Only the assigned vendor can start this conversation';
  END IF;

  IF v_request.owner_id IS NULL
     OR v_request.tenant_id IS NULL
     OR v_request.property_id IS NULL THEN
    RAISE EXCEPTION 'Maintenance request is missing conversation participants';
  END IF;

  IF v_request.status IN ('completed', 'closed')
     AND NOT EXISTS (
       SELECT 1
       FROM public.maintenance_invoices invoice
       WHERE invoice.maintenance_request_id = v_request.id
         AND invoice.vendor_id = v_actor
         AND invoice.status IN ('submitted', 'rejected', 'disputed')
     ) THEN
    RAISE EXCEPTION 'This completed job has no open invoice conversation';
  END IF;

  SELECT thread.id
  INTO v_thread_id
  FROM public.message_threads thread
  WHERE thread.owner_id = v_request.owner_id
    AND thread.tenant_id = v_request.tenant_id
    AND thread.property_id = v_request.property_id
    AND thread.category = 'maintenance'
    AND thread.status = 'active'
  ORDER BY thread.last_message_at DESC NULLS LAST, thread.created_at DESC
  LIMIT 1;

  IF v_thread_id IS NULL THEN
    INSERT INTO public.message_threads (
      owner_id,
      tenant_id,
      property_id,
      subject,
      category,
      status,
      last_message_at
    )
    VALUES (
      v_request.owner_id,
      v_request.tenant_id,
      v_request.property_id,
      'Maintenance: ' || COALESCE(v_request.title, 'Job'),
      'maintenance',
      'active',
      NOW()
    )
    RETURNING id INTO v_thread_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.messages message
    WHERE message.thread_id = v_thread_id
      AND message.sender_id = v_actor
      AND message.sender_role = 'vendor'
  ) THEN
    INSERT INTO public.messages (
      thread_id,
      content,
      sender_id,
      sender_role
    )
    VALUES (
      v_thread_id,
      BTRIM(p_initial_message),
      v_actor,
      'vendor'
    );

    UPDATE public.message_threads
    SET last_message_at = NOW(),
        unread_count_owner = COALESCE(unread_count_owner, 0) + 1
    WHERE id = v_thread_id;
  END IF;

  RETURN v_thread_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_vendor_maintenance_thread(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE
  ON FUNCTION public.bootstrap_vendor_maintenance_thread(UUID, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.bootstrap_vendor_maintenance_thread(UUID, TEXT) IS
  'Assigned-vendor first contact for active maintenance work or an open post-completion invoice. Auth and assignment are checked inside the SECURITY DEFINER function.';
