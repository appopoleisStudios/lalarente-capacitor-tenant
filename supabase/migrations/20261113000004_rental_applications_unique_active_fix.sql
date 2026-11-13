-- One live application per tenant per property — but a withdrawn, rejected or
-- expired application must not block a fresh one. The existing
-- idx_rental_applications_unique_active (created outside migrations) also
-- covered 'withdrawn', so a tenant who withdrew could never apply again:
--   "duplicate key value violates unique constraint idx_rental_applications_unique_active"
-- The app already lets them re-apply (TenantPropertyDetailScreen), and still
-- enforces the 3-month wait after a rejection.

ALTER TABLE public.rental_applications
  DROP CONSTRAINT IF EXISTS idx_rental_applications_unique_active;
DROP INDEX IF EXISTS public.idx_rental_applications_unique_active;

CREATE UNIQUE INDEX idx_rental_applications_unique_active
  ON public.rental_applications (property_id, tenant_id)
  WHERE status NOT IN ('withdrawn', 'rejected', 'expired', 'cancelled');
