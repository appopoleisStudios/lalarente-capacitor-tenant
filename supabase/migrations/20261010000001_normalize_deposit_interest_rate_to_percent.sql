-- Migration: normalize deposit_interest_rate to percentage units
--
-- DB contract: deposit_interest_rate is stored as a percentage (e.g. 7.25 = 7.25% p.a.).
-- Any rows written before this contract was established may have stored the rate as a
-- decimal (e.g. 0.0525 = 5.25%). This migration converts those rows in-place.
--
-- Safe: only touches rows where rate < 1 (unambiguously decimal-formatted).
-- A stored percentage of 1% or above is unchanged.
-- A stored decimal like 0.0525 becomes 5.25; 0.07 becomes 7.0; etc.

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
