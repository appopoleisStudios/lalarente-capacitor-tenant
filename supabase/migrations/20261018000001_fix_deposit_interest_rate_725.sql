-- Fix deposit_interest_rate values that were stored as 725 instead of 7.25.
-- DB contract: deposit_interest_rate is stored as a percentage (e.g. 7.25 = 7.25% p.a.).
-- A prior data entry bug set the value to 725 (100x the correct rate).

-- Fix leases table
UPDATE leases
SET deposit_interest_rate = deposit_interest_rate / 100
WHERE deposit_interest_rate >= 100;

-- Fix accruals: interest_rate was stored as the normalised decimal (annualRate = rawRate/100).
-- For rows written when rawRate was 725, interest_rate was stored as 7.25 (not 0.0725).
-- Correct those rows to 0.0725.
UPDATE deposit_interest_accruals
SET interest_rate = interest_rate / 100
WHERE interest_rate >= 1;
