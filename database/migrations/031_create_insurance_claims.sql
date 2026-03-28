-- Migration 031: Insurance Claims
--
-- Tracks building insurance policies and claims for rental properties.
-- Links to maintenance requests for damage-related claims.

BEGIN;

-- ─── Insurance Policies ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insurance_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id),

  policy_number TEXT NOT NULL,
  insurer_name TEXT NOT NULL,
  insurer_contact TEXT,
  insurer_email TEXT,

  policy_type TEXT NOT NULL CHECK (policy_type IN (
    'building',     -- Building/structure insurance
    'contents',     -- Contents insurance
    'liability',    -- Public liability
    'comprehensive' -- Combined coverage
  )),

  premium_amount DECIMAL(10,2),
  premium_frequency TEXT CHECK (premium_frequency IN ('monthly', 'quarterly', 'annually')),
  excess_amount DECIMAL(10,2), -- Policy excess/deductible
  cover_amount DECIMAL(10,2),  -- Maximum coverage

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'lapsed')),

  policy_document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insurance_policies_property ON insurance_policies (property_id);
CREATE INDEX idx_insurance_policies_owner ON insurance_policies (owner_id);
CREATE INDEX idx_insurance_policies_status ON insurance_policies (status);

-- ─── Insurance Claims ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insurance_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  maintenance_request_id UUID REFERENCES maintenance_requests(id),

  claim_number TEXT, -- Assigned by insurer
  claim_type TEXT NOT NULL CHECK (claim_type IN (
    'fire_damage',
    'water_damage',
    'storm_damage',
    'theft',
    'vandalism',
    'structural_damage',
    'electrical_damage',
    'plumbing',
    'natural_disaster',
    'other'
  )),

  description TEXT NOT NULL,
  incident_date DATE NOT NULL,
  estimated_cost DECIMAL(10,2) NOT NULL,
  claimed_amount DECIMAL(10,2),
  approved_amount DECIMAL(10,2),
  excess_paid DECIMAL(10,2),
  payout_received DECIMAL(10,2),

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',         -- Being prepared
    'submitted',     -- Sent to insurer
    'acknowledged',  -- Insurer acknowledged
    'assessment',    -- Assessor assigned
    'approved',      -- Claim approved
    'partially_approved',
    'rejected',      -- Claim rejected
    'paid_out',      -- Payout received
    'closed'
  )),

  -- Assessor
  assessor_name TEXT,
  assessor_contact TEXT,
  assessment_date DATE,
  assessment_notes TEXT,

  -- Rejection
  rejection_reason TEXT,

  -- Dates
  submitted_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  paid_out_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insurance_claims_policy ON insurance_claims (policy_id);
CREATE INDEX idx_insurance_claims_property ON insurance_claims (property_id);
CREATE INDEX idx_insurance_claims_owner ON insurance_claims (owner_id);
CREATE INDEX idx_insurance_claims_status ON insurance_claims (status);
CREATE INDEX idx_insurance_claims_maintenance ON insurance_claims (maintenance_request_id);

-- ─── Claim Documents ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insurance_claim_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,

  document_type TEXT NOT NULL CHECK (document_type IN (
    'photo',
    'video',
    'quote',
    'invoice',
    'police_report',
    'assessment_report',
    'correspondence',
    'other'
  )),
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claim_documents_claim ON insurance_claim_documents (claim_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage their policies"
  ON insurance_policies FOR ALL TO authenticated
  USING (owner_id = auth.uid());

ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage their claims"
  ON insurance_claims FOR ALL TO authenticated
  USING (owner_id = auth.uid());

ALTER TABLE insurance_claim_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Claim document access"
  ON insurance_claim_documents FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM insurance_claims
    WHERE insurance_claims.id = insurance_claim_documents.claim_id
    AND insurance_claims.owner_id = auth.uid()
  ));

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ Insurance claims tables created.';
END $$;
