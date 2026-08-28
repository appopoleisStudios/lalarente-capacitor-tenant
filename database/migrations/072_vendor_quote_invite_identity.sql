-- Migration 072: Idempotent quote invitations with inviter attribution
--
-- A maintenance request may invite a vendor only once. New invitations record
-- the owner or tenant who sent them; historical rows remain honestly unknown.

ALTER TABLE public.vendor_quote_requests
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_by_role TEXT;

ALTER TABLE public.vendor_quote_requests
  DROP CONSTRAINT IF EXISTS vendor_quote_requests_invited_by_role_check;
ALTER TABLE public.vendor_quote_requests
  ADD CONSTRAINT vendor_quote_requests_invited_by_role_check
  CHECK (invited_by_role IS NULL OR invited_by_role IN ('owner', 'tenant'));

-- Keep the most useful row if an older environment already contains duplicates.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY request_id, vendor_id
      ORDER BY (quote_id IS NOT NULL) DESC, responded_at DESC NULLS LAST, created_at ASC, id ASC
    ) AS duplicate_rank
  FROM public.vendor_quote_requests
)
DELETE FROM public.vendor_quote_requests request
USING ranked
WHERE request.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_quote_requests_request_vendor_unique
  ON public.vendor_quote_requests (request_id, vendor_id);

DROP POLICY IF EXISTS vendor_quote_requests_job_party_insert
  ON public.vendor_quote_requests;
CREATE POLICY vendor_quote_requests_job_party_insert
  ON public.vendor_quote_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    invited_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles actor
      WHERE actor.id = (SELECT auth.uid())
        AND actor.role::TEXT = invited_by_role
        AND actor.role::TEXT IN ('owner', 'tenant')
    )
    AND EXISTS (
      SELECT 1
      FROM public.maintenance_requests request
      WHERE request.id = request_id
        AND (
          (invited_by_role = 'owner' AND request.owner_id = (SELECT auth.uid()))
          OR
          (invited_by_role = 'tenant' AND request.tenant_id = (SELECT auth.uid()))
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles vendor
      WHERE vendor.id = vendor_id
        AND vendor.role = 'vendor'
    )
  );

COMMENT ON COLUMN public.vendor_quote_requests.invited_by IS
  'Authenticated owner or tenant who sent this quote invitation. NULL only for historical rows.';
COMMENT ON COLUMN public.vendor_quote_requests.invited_by_role IS
  'Inviter role at send time: owner or tenant. NULL only for historical rows.';
COMMENT ON INDEX public.vendor_quote_requests_request_vendor_unique IS
  'Prevents duplicate quote invitations for the same maintenance request and vendor.';
COMMENT ON POLICY vendor_quote_requests_job_party_insert
  ON public.vendor_quote_requests IS
  'A job owner or tenant may invite a vendor while persisting and validating their inviter identity.';
