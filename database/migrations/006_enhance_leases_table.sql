-- Migration: Enhance leases table for rental management
-- Task: 1.6 Enhance leases table
-- Requirements: 8, 9
-- Date: 2025-11-01

BEGIN;

-- Add new columns to leases table
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES rental_applications(id),
  ADD COLUMN IF NOT EXISTS lease_type TEXT,
  ADD COLUMN IF NOT EXISTS payment_due_day INTEGER,
  ADD COLUMN IF NOT EXISTS late_fee_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS late_fee_grace_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rent_escalation_type TEXT,
  ADD COLUMN IF NOT EXISTS rent_escalation_value DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS rent_escalation_frequency_months INTEGER,
  ADD COLUMN IF NOT EXISTS document_template_id UUID,
  ADD COLUMN IF NOT EXISTS owner_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tenant_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS tenant_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Rename columns safely (check if old name exists first)
DO $$ 
BEGIN
  -- Rename lease_start to start_date
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'lease_start'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE leases RENAME COLUMN lease_start TO start_date;
    RAISE NOTICE 'Renamed lease_start to start_date';
  END IF;
  
  -- Rename lease_end to end_date
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'lease_end'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE leases RENAME COLUMN lease_end TO end_date;
    RAISE NOTICE 'Renamed lease_end to end_date';
  END IF;
  
  -- Rename rent_amount to monthly_rent
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'rent_amount'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'monthly_rent'
  ) THEN
    ALTER TABLE leases RENAME COLUMN rent_amount TO monthly_rent;
    RAISE NOTICE 'Renamed rent_amount to monthly_rent';
  END IF;
END $$;

-- Update status constraint
ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_status_check;
ALTER TABLE leases 
  ADD CONSTRAINT leases_status_check 
  CHECK (status IN ('draft', 'pending_signatures', 'active', 'expired', 'terminated'));

-- Add CHECK constraints safely
DO $$
BEGIN
  -- lease_type constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leases_lease_type_check'
  ) THEN
    ALTER TABLE leases 
      ADD CONSTRAINT leases_lease_type_check 
      CHECK (lease_type IN ('fixed', 'month_to_month'));
  END IF;
  
  -- payment_due_day constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leases_payment_due_day_check'
  ) THEN
    ALTER TABLE leases 
      ADD CONSTRAINT leases_payment_due_day_check 
      CHECK (payment_due_day BETWEEN 1 AND 31);
  END IF;
  
  -- rent_escalation_type constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leases_rent_escalation_type_check'
  ) THEN
    ALTER TABLE leases 
      ADD CONSTRAINT leases_rent_escalation_type_check 
      CHECK (rent_escalation_type IN ('fixed_percentage', 'fixed_amount', 'cpi_linked'));
  END IF;
  
  -- dates_valid constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leases_dates_valid'
  ) THEN
    ALTER TABLE leases 
      ADD CONSTRAINT leases_dates_valid 
      CHECK (end_date > start_date);
  END IF;
  
  -- rent_positive constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leases_rent_positive'
  ) THEN
    ALTER TABLE leases 
      ADD CONSTRAINT leases_rent_positive 
      CHECK (monthly_rent > 0);
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leases_property ON leases(property_id);
CREATE INDEX IF NOT EXISTS idx_leases_owner ON leases(owner_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_status ON leases(status);
CREATE INDEX IF NOT EXISTS idx_leases_dates ON leases(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leases_application ON leases(application_id);

-- Add comments
COMMENT ON COLUMN leases.lease_type IS 'Type of lease: fixed term or month-to-month';
COMMENT ON COLUMN leases.payment_due_day IS 'Day of month rent is due (1-31)';
COMMENT ON COLUMN leases.late_fee_amount IS 'Late fee charged if rent is overdue';
COMMENT ON COLUMN leases.late_fee_grace_days IS 'Grace period before late fee applies';
COMMENT ON COLUMN leases.rent_escalation_type IS 'How rent increases: fixed_percentage, fixed_amount, or cpi_linked';
COMMENT ON COLUMN leases.rent_escalation_value IS 'Value for rent escalation (percentage or amount)';
COMMENT ON COLUMN leases.rent_escalation_frequency_months IS 'How often rent escalates (in months)';
COMMENT ON COLUMN leases.owner_signed_at IS 'Timestamp when owner signed the lease';
COMMENT ON COLUMN leases.tenant_signed_at IS 'Timestamp when tenant signed the lease';
COMMENT ON COLUMN leases.executed_at IS 'Timestamp when lease became active (both parties signed)';

-- Create lease_addendums table
CREATE TABLE IF NOT EXISTS lease_addendums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('modification', 'extension', 'termination')),
  description TEXT NOT NULL,
  changes JSONB NOT NULL,
  
  -- Signatures
  owner_signed_at TIMESTAMPTZ,
  tenant_signed_at TIMESTAMPTZ,
  
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for lease_addendums
CREATE INDEX IF NOT EXISTS idx_lease_addendums_lease ON lease_addendums(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_addendums_type ON lease_addendums(type);

-- Add comments
COMMENT ON TABLE lease_addendums IS 'Stores lease modifications, extensions, and termination notices';
COMMENT ON COLUMN lease_addendums.type IS 'Type of addendum: modification, extension, or termination';
COMMENT ON COLUMN lease_addendums.changes IS 'JSON object describing the changes made';

-- Set up Row Level Security for leases
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies for leases
DROP POLICY IF EXISTS "Tenants can view their leases" ON leases;
DROP POLICY IF EXISTS "Owners can view their leases" ON leases;
DROP POLICY IF EXISTS "Owners can create leases" ON leases;
DROP POLICY IF EXISTS "Owners can update their leases" ON leases;
DROP POLICY IF EXISTS "Tenants can update their leases" ON leases;

CREATE POLICY "Tenants can view their leases"
  ON leases FOR SELECT
  USING (tenant_id = auth.uid());

CREATE POLICY "Owners can view their leases"
  ON leases FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can create leases"
  ON leases FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their leases"
  ON leases FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Tenants can update their leases"
  ON leases FOR UPDATE
  USING (tenant_id = auth.uid());

-- Set up Row Level Security for lease_addendums
ALTER TABLE lease_addendums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view lease addendums" ON lease_addendums;
DROP POLICY IF EXISTS "Owners can create lease addendums" ON lease_addendums;
DROP POLICY IF EXISTS "Users can update lease addendums" ON lease_addendums;

CREATE POLICY "Users can view lease addendums"
  ON lease_addendums FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases
      WHERE leases.id = lease_addendums.lease_id
      AND (leases.tenant_id = auth.uid() OR leases.owner_id = auth.uid())
    )
  );

CREATE POLICY "Owners can create lease addendums"
  ON lease_addendums FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases
      WHERE leases.id = lease_addendums.lease_id
      AND leases.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update lease addendums"
  ON lease_addendums FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM leases
      WHERE leases.id = lease_addendums.lease_id
      AND (leases.tenant_id = auth.uid() OR leases.owner_id = auth.uid())
    )
  );

-- Create trigger functions
CREATE OR REPLACE FUNCTION update_leases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_lease_execution()
RETURNS TRIGGER AS $$
BEGIN
  -- If both parties have signed and lease is not yet executed
  IF NEW.owner_signed_at IS NOT NULL 
     AND NEW.tenant_signed_at IS NOT NULL 
     AND NEW.executed_at IS NULL THEN
    NEW.executed_at = NOW();
    NEW.status = 'active';
    
    -- Update property status to rented
    UPDATE properties 
    SET status = 'rented' 
    WHERE id = NEW.property_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS leases_updated_at ON leases;
CREATE TRIGGER leases_updated_at
  BEFORE UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION update_leases_updated_at();

DROP TRIGGER IF EXISTS check_lease_execution_trigger ON leases;
CREATE TRIGGER check_lease_execution_trigger
  BEFORE INSERT OR UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION check_lease_execution();

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Leases table enhanced successfully';
END $$;
