-- CT7-029: rent voided because the lease ended needs its own status;
-- 'failed' would misstate it. Adds 'cancelled' (and keeps 'overdue', which
-- the payments state-machine trigger already handles).
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'overdue', 'cancelled'));
