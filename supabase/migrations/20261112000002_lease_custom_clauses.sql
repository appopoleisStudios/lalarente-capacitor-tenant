-- CT7-022: add custom-clauses text column to leases.
-- Stores owner-authored additional terms appended to the PDF.
-- NULL = no custom clauses (existing leases unaffected).
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS lease_custom_clauses text;
