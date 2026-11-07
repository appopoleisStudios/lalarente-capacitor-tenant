-- 077_viewing_no_show.sql
--
-- CT7-015 — owner should confirm after a scheduled viewing whether
-- the tenant actually viewed the property. Adds a `no_show` status
-- to the viewing_requests enum so the owner can record a tenant
-- who didn't turn up (separate from `completed` which = viewed OK).

ALTER TABLE viewing_requests DROP CONSTRAINT IF EXISTS viewing_requests_status_check;

ALTER TABLE viewing_requests
  ADD CONSTRAINT viewing_requests_status_check
  CHECK (status IN ('pending', 'approved', 'declined', 'completed', 'cancelled', 'no_show', 'expired'));
