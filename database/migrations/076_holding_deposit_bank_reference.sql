-- 076_holding_deposit_bank_reference.sql
--
-- CT7-018 — deterministic, UNIQUE, NULL-safe bank reference on every
-- holding deposit row so owners can reconcile EFT payments on their
-- bank statement back to a specific deposit.
--
-- Design decisions (addresses PR #203 r1 SA findings):
--   - Reference is derived from the DEPOSIT's own uuid, NOT application /
--     property. So application_id = NULL (allowed by schema) doesn't
--     break the trigger, and multiple deposits for the same application
--     each get their own reference.
--   - 8-char hex slice of the uuid → 16.7M distinct values. Combined
--     with the DB UNIQUE constraint below, collisions can't ship.
--   - Format: LAL-HD-<8char>  e.g. LAL-HD-A4B29C3D  →  15 chars, fits
--     every SA acquirer's reference field.

ALTER TABLE holding_deposits
  ADD COLUMN IF NOT EXISTS reference text;

CREATE OR REPLACE FUNCTION set_holding_deposit_reference()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.reference IS NOT NULL AND length(trim(NEW.reference)) > 0 THEN
    RETURN NEW;
  END IF;

  -- Use the deposit's own id — NULL-safe, unique by definition, and
  -- each deposit is self-identifying regardless of whether an
  -- application is linked yet.
  NEW.reference := 'LAL-HD-' || UPPER(substring(NEW.id::text, 1, 8));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_holding_deposit_reference ON holding_deposits;
CREATE TRIGGER trg_holding_deposit_reference
  BEFORE INSERT ON holding_deposits
  FOR EACH ROW EXECUTE FUNCTION set_holding_deposit_reference();

-- Backfill: existing rows use their own id. Idempotent — only touches
-- rows that are still NULL.
UPDATE holding_deposits
SET reference = 'LAL-HD-' || UPPER(substring(id::text, 1, 8))
WHERE reference IS NULL;

ALTER TABLE holding_deposits ALTER COLUMN reference SET NOT NULL;

-- Belt-and-braces: DB-level uniqueness. 8-char hex from a v4 UUID has
-- ~4 billion / 16.7M collision probability; a UNIQUE INDEX shuts that
-- door entirely. If a collision ever did happen the INSERT would fail
-- noisily and we'd retry — much better than silent reconciliation
-- ambiguity on an owner's bank statement.
CREATE UNIQUE INDEX IF NOT EXISTS idx_holding_deposits_reference_unique
  ON holding_deposits (reference);
