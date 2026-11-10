-- CT7-024: Property tax payment ledger
-- New table for owners to record rates, levies, bond interest, insurance, etc.
-- Rolls up into OwnerTaxReportScreen for ITR12 deductible subtotal.

CREATE TABLE IF NOT EXISTS property_tax_payments (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       uuid          NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id          uuid          NOT NULL REFERENCES profiles(id),
  category          text          NOT NULL
    CHECK (category IN (
      'municipal_rates',
      'municipal_levies',
      'sectional_title_levy',
      'bond_interest',
      'insurance',
      'other'
    )),
  description       text,
  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  paid_on           date          NOT NULL,
  deductibility     text          NOT NULL DEFAULT 'uncertain'
    CHECK (deductibility IN (
      'allowable',
      'capital',
      'mixed_use',
      'private',
      'uncertain'
    )),
  apportionment_pct numeric(5,2)
    CHECK (
      apportionment_pct IS NULL
      OR (apportionment_pct >= 0 AND apportionment_pct <= 100)
    ),
  document_url      text,
  created_at        timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT ptp_apportionment_required_for_mixed CHECK (
    (deductibility = 'mixed_use' AND apportionment_pct IS NOT NULL)
    OR (deductibility <> 'mixed_use' AND apportionment_pct IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_prop_tax_owner_year
  ON property_tax_payments(owner_id, paid_on);

CREATE INDEX IF NOT EXISTS idx_prop_tax_property
  ON property_tax_payments(property_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE property_tax_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_tax_payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ptp_select ON property_tax_payments;
CREATE POLICY ptp_select ON property_tax_payments
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS ptp_insert ON property_tax_payments;
CREATE POLICY ptp_insert ON property_tax_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ptp_update ON property_tax_payments;
CREATE POLICY ptp_update ON property_tax_payments
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ptp_delete ON property_tax_payments;
CREATE POLICY ptp_delete ON property_tax_payments
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );
