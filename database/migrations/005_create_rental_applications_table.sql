-- Migration: Create rental_applications table
-- Task: 1.5 Create rental_applications table
-- Requirements: 6, 7
-- Date: 2025-11-01

BEGIN;

-- Create rental_applications table
CREATE TABLE IF NOT EXISTS rental_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
  
  -- Personal Info
  full_name TEXT NOT NULL,
  email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  phone TEXT NOT NULL,
  id_number TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  
  -- Employment
  employer TEXT,
  position TEXT,
  monthly_income DECIMAL(10, 2),
  employment_start_date DATE,
  employer_contact TEXT,
  
  -- Rental History (stored as JSONB for flexibility)
  rental_history JSONB,
  
  -- Documents
  id_document_url TEXT,
  proof_of_income_urls TEXT[],
  reference_urls TEXT[],
  
  -- Screening
  background_check_status TEXT CHECK (background_check_status IN ('pending', 'completed', 'failed')),
  background_check_result JSONB,
  credit_check_status TEXT CHECK (credit_check_status IN ('pending', 'completed', 'failed')),
  credit_check_result JSONB,
  identity_verification_status TEXT CHECK (identity_verification_status IN ('pending', 'verified', 'failed')),
  affordability_ratio DECIMAL(5, 2) CHECK (affordability_ratio IS NULL OR (affordability_ratio >= 0 AND affordability_ratio <= 1)),
  
  -- Scoring
  application_score INTEGER CHECK (application_score >= 0 AND application_score <= 100),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  
  -- Approval/Rejection
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  rejected_by UUID REFERENCES profiles(id),
  rejected_at TIMESTAMPTZ,
  
  -- Notes
  owner_notes TEXT,
  tenant_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rental_applications_property ON rental_applications(property_id);
CREATE INDEX IF NOT EXISTS idx_rental_applications_tenant ON rental_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rental_applications_owner ON rental_applications(owner_id);
CREATE INDEX IF NOT EXISTS idx_rental_applications_status ON rental_applications(status);
CREATE INDEX IF NOT EXISTS idx_rental_applications_submitted_at ON rental_applications(submitted_at);

-- Prevent duplicate active applications
CREATE UNIQUE INDEX IF NOT EXISTS idx_rental_applications_unique_active
  ON rental_applications(property_id, tenant_id)
  WHERE status NOT IN ('rejected');

-- Add comments
COMMENT ON TABLE rental_applications IS 'Stores rental applications from prospective tenants';
COMMENT ON COLUMN rental_applications.affordability_ratio IS 'Rent to income ratio (should be <= 0.30 for affordability)';
COMMENT ON COLUMN rental_applications.application_score IS 'Automated score (0-100)';
COMMENT ON COLUMN rental_applications.owner_notes IS 'Private owner notes';
COMMENT ON COLUMN rental_applications.tenant_notes IS 'Cover letter from tenant';

-- Set up Row Level Security
ALTER TABLE rental_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their applications"
  ON rental_applications FOR SELECT
  USING (tenant_id = auth.uid());

CREATE POLICY "Owners can view applications for their properties"
  ON rental_applications FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Tenants can create applications"
  ON rental_applications FOR INSERT
  WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenants can update their draft applications"
  ON rental_applications FOR UPDATE
  USING (tenant_id = auth.uid() AND status = 'draft');

CREATE POLICY "Owners can update applications for their properties"
  ON rental_applications FOR UPDATE
  USING (owner_id = auth.uid());

-- Create co_applicants table
CREATE TABLE IF NOT EXISTS co_applicants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  primary_application_id UUID NOT NULL REFERENCES rental_applications(id) ON DELETE CASCADE,
  
  full_name TEXT NOT NULL,
  email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  phone TEXT NOT NULL,
  id_number TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  monthly_income DECIMAL(10, 2),
  relationship_to_primary TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_co_applicants_application ON co_applicants(primary_application_id);

COMMENT ON TABLE co_applicants IS 'Stores co-applicants (roommates) for rental applications';

ALTER TABLE co_applicants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view co-applicants for their applications"
  ON co_applicants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rental_applications
      WHERE rental_applications.id = co_applicants.primary_application_id
      AND (rental_applications.tenant_id = auth.uid() OR rental_applications.owner_id = auth.uid())
    )
  );

CREATE POLICY "Tenants can insert co-applicants"
  ON co_applicants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rental_applications
      WHERE rental_applications.id = co_applicants.primary_application_id
      AND rental_applications.tenant_id = auth.uid()
    )
  );

-- Triggers
CREATE OR REPLACE FUNCTION update_rental_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rental_applications_updated_at
  BEFORE UPDATE ON rental_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_rental_applications_updated_at();

-- Auto-set timestamps on status changes
CREATE OR REPLACE FUNCTION update_application_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'submitted' AND OLD.status = 'draft' THEN
    NEW.submitted_at := NOW();
  END IF;
  
  IF NEW.status = 'under_review' AND OLD.status != 'under_review' THEN
    NEW.reviewed_at := NOW();
  END IF;
  
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    NEW.approved_at := NOW();
    NEW.approved_by := auth.uid();
  END IF;
  
  IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    NEW.rejected_at := NOW();
    NEW.rejected_by := auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_application_timestamps
  BEFORE UPDATE ON rental_applications
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_application_timestamps();

-- Helper Functions
CREATE OR REPLACE FUNCTION calculate_affordability_ratio(
  rent_amount DECIMAL,
  monthly_income DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
  IF monthly_income IS NULL OR monthly_income = 0 THEN
    RETURN NULL;
  END IF;
  RETURN ROUND((rent_amount / monthly_income)::DECIMAL, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper View
CREATE OR REPLACE VIEW rental_applications_with_details AS
SELECT 
  ra.*,
  p.address as property_address,
  p.rent_amount as property_rent,
  t.full_name as tenant_name,
  o.full_name as owner_name,
  (
    ra.monthly_income + COALESCE(
      (SELECT SUM(monthly_income) FROM co_applicants WHERE primary_application_id = ra.id),
      0
    )
  ) as total_household_income,
  (SELECT COUNT(*) FROM co_applicants WHERE primary_application_id = ra.id) as co_applicant_count
FROM rental_applications ra
JOIN properties p ON p.id = ra.property_id
JOIN profiles t ON t.id = ra.tenant_id
JOIN profiles o ON o.id = ra.owner_id;

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ rental_applications and co_applicants tables created successfully';
END $$;
