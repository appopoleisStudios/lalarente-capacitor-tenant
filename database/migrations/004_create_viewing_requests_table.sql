-- Migration: Create viewing_requests table
-- Task: 1.4 Create viewing_requests table
-- Requirements: 5
-- Date: 2025-11-01

BEGIN;

-- Create viewing_requests table
CREATE TABLE IF NOT EXISTS viewing_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Request Details
  requested_date DATE NOT NULL,
  requested_time TIME NOT NULL,
  tenant_notes TEXT,
  
  -- Response
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'completed', 'cancelled')),
  owner_response TEXT,
  alternative_times TIMESTAMPTZ[],
  
  -- Confirmation
  confirmed_date TIMESTAMPTZ,
  
  -- Completion Tracking
  completed_at TIMESTAMPTZ,
  tenant_attended BOOLEAN,
  tenant_feedback TEXT,
  owner_notes TEXT,
  
  -- Cancellation Tracking
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES profiles(id),
  cancellation_reason TEXT,
  
  -- Notification Tracking
  reminder_sent_at TIMESTAMPTZ,
  owner_notified_at TIMESTAMPTZ,
  tenant_notified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_viewing_requests_property ON viewing_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_tenant ON viewing_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_owner ON viewing_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_status ON viewing_requests(status);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_requested_date ON viewing_requests(requested_date);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_cancelled_by ON viewing_requests(cancelled_by);

-- Prevent multiple pending requests for same property/tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_viewing_requests_unique_pending
  ON viewing_requests(property_id, tenant_id)
  WHERE status = 'pending';

-- Add comments
COMMENT ON TABLE viewing_requests IS 'Stores property viewing requests from prospective tenants';
COMMENT ON COLUMN viewing_requests.requested_date IS 'Date tenant wants to view the property';
COMMENT ON COLUMN viewing_requests.requested_time IS 'Time tenant wants to view the property';
COMMENT ON COLUMN viewing_requests.tenant_notes IS 'Optional notes or questions from tenant';
COMMENT ON COLUMN viewing_requests.status IS 'Current status of the viewing request';
COMMENT ON COLUMN viewing_requests.owner_response IS 'Owner response message';
COMMENT ON COLUMN viewing_requests.alternative_times IS 'Alternative viewing times proposed by owner';
COMMENT ON COLUMN viewing_requests.confirmed_date IS 'Final confirmed viewing date and time';
COMMENT ON COLUMN viewing_requests.completed_at IS 'When viewing was marked as completed';
COMMENT ON COLUMN viewing_requests.tenant_attended IS 'Whether tenant actually attended';
COMMENT ON COLUMN viewing_requests.tenant_feedback IS 'Tenant feedback after viewing';
COMMENT ON COLUMN viewing_requests.owner_notes IS 'Owner private notes';
COMMENT ON COLUMN viewing_requests.cancelled_at IS 'When viewing was cancelled';
COMMENT ON COLUMN viewing_requests.cancelled_by IS 'Who cancelled the viewing';
COMMENT ON COLUMN viewing_requests.cancellation_reason IS 'Reason for cancellation';

-- Set up Row Level Security (RLS)
ALTER TABLE viewing_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can view their own viewing requests
CREATE POLICY "Tenants can view their viewing requests"
  ON viewing_requests FOR SELECT
  USING (tenant_id = auth.uid());

-- Policy: Owners can view viewing requests for their properties
CREATE POLICY "Owners can view viewing requests for their properties"
  ON viewing_requests FOR SELECT
  USING (owner_id = auth.uid());

-- Policy: Tenants can create viewing requests
CREATE POLICY "Tenants can create viewing requests"
  ON viewing_requests FOR INSERT
  WITH CHECK (tenant_id = auth.uid());

-- Policy: Owners can update viewing requests for their properties
CREATE POLICY "Owners can update viewing requests for their properties"
  ON viewing_requests FOR UPDATE
  USING (owner_id = auth.uid());

-- Policy: Tenants can update their own viewing requests
CREATE POLICY "Tenants can update their viewing requests"
  ON viewing_requests FOR UPDATE
  USING (tenant_id = auth.uid());

-- Function to automatically set updated_at timestamp
CREATE OR REPLACE FUNCTION update_viewing_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row update
CREATE TRIGGER viewing_requests_updated_at
  BEFORE UPDATE ON viewing_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_viewing_requests_updated_at();

-- Function to validate status transitions and auto-set timestamps
CREATE OR REPLACE FUNCTION validate_viewing_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent invalid transitions
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Cannot change status of completed viewing';
  END IF;
  
  IF OLD.status = 'cancelled' AND NEW.status != 'cancelled' THEN
    RAISE EXCEPTION 'Cannot reopen cancelled viewing';
  END IF;
  
  -- Auto-set timestamps
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at := NOW();
  END IF;
  
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.cancelled_at := NOW();
    NEW.cancelled_by := auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_viewing_status
  BEFORE UPDATE ON viewing_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION validate_viewing_status_transition();

-- Create helper view
CREATE OR REPLACE VIEW viewing_requests_with_details AS
SELECT 
  vr.*,
  p.address as property_address,
  p.rent_amount as property_rent,
  p.bedrooms as property_bedrooms,
  t.full_name as tenant_name,
  t.email as tenant_email,
  t.phone as tenant_phone,
  o.full_name as owner_name,
  o.email as owner_email,
  o.phone as owner_phone
FROM viewing_requests vr
JOIN properties p ON p.id = vr.property_id
JOIN profiles t ON t.id = vr.tenant_id
JOIN profiles o ON o.id = vr.owner_id;

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ viewing_requests table created successfully';
END $$;
