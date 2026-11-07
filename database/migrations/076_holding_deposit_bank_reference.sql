-- 076_holding_deposit_bank_reference.sql
--
-- CT7-018 — when the tenant pays a holding deposit by EFT, the bank
-- statement line needs to identify what the payment was for so the
-- owner can reconcile. The current deposit flow writes nothing the
-- owner can grep for.
--
-- Add a `reference` text column populated at INSERT time by a trigger,
-- format `LAL-HD-<app4>-<prop4>` (max ~15 chars — fits every SA bank's
-- reference field including the ~20-char FNB/Standard Bank limits).
-- Backfilled for existing rows; NOT NULL enforced going forward.

ALTER TABLE holding_deposits
  ADD COLUMN IF NOT EXISTS reference text;

CREATE OR REPLACE FUNCTION set_holding_deposit_reference()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  app_short text;
  prop_short text;
BEGIN
  IF NEW.reference IS NOT NULL AND length(trim(NEW.reference)) > 0 THEN
    RETURN NEW;
  END IF;

  -- Last 4 chars of each UUID — enough entropy to disambiguate for a
  -- given owner's bank statement; short enough to fit every acquirer.
  app_short := UPPER(substring(NEW.application_id::text from length(NEW.application_id::text) - 3));
  prop_short := UPPER(substring(NEW.property_id::text from length(NEW.property_id::text) - 3));

  NEW.reference := 'LAL-HD-' || app_short || '-' || prop_short;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_holding_deposit_reference ON holding_deposits;
CREATE TRIGGER trg_holding_deposit_reference
  BEFORE INSERT ON holding_deposits
  FOR EACH ROW EXECUTE FUNCTION set_holding_deposit_reference();

-- Backfill any pre-existing rows missing a reference.
UPDATE holding_deposits
SET reference = 'LAL-HD-'
  || UPPER(substring(application_id::text from length(application_id::text) - 3))
  || '-'
  || UPPER(substring(property_id::text from length(property_id::text) - 3))
WHERE reference IS NULL;

-- Enforce going forward.
ALTER TABLE holding_deposits ALTER COLUMN reference SET NOT NULL;
