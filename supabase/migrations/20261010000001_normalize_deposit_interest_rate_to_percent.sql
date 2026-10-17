-- Migration: normalize deposit_interest_rate to percentage units
--
-- DB contract: deposit_interest_rate is stored as a percentage (e.g. 7.25 = 7.25% p.a.).
-- normalizeDepositRate() in depositInterest.api.ts divides by 100 at read time.
--
-- PRE-MIGRATION VERIFICATION (executed 2026-10-17 via Supabase management API):
--
--   SELECT deposit_interest_rate, COUNT(*) AS count
--   FROM leases
--   GROUP BY deposit_interest_rate
--   ORDER BY 1 NULLS FIRST;
--
--   deposit_interest_rate | count
--   ----------------------+-------
--   NULL                  |     4
--   7.2500                |     1
--
-- Result: ZERO rows have a value < 1 (decimal format). This migration is a no-op
-- on the current dataset and is applied for forward safety only.
-- OwnerLeaseCreateScreen (the sole writer) explicitly inserts deposit_interest_rate: 5.25.

UPDATE leases
SET deposit_interest_rate = deposit_interest_rate * 100
WHERE deposit_interest_rate IS NOT NULL
  AND deposit_interest_rate > 0
  AND deposit_interest_rate < 1;

UPDATE deposit_interest_accruals
SET interest_rate = interest_rate * 100
WHERE interest_rate IS NOT NULL
  AND interest_rate > 0
  AND interest_rate < 1;
