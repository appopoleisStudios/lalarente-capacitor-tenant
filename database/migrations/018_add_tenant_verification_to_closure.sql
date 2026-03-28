-- Migration 018: Add tenant verification to closure workflow
-- This implements industry-standard tenant verification following BuildingLink/AppFolio patterns
-- Run this in Supabase SQL Editor

-- Add tenant verification fields to closure_reports table
ALTER TABLE closure_reports
ADD COLUMN IF NOT EXISTS tenant_verification_status TEXT
  CHECK (tenant_verification_status IN (
    'pending_owner',
    'pending_tenant',
    'tenant_approved',
    'tenant_rejected',
    'auto_approved',
    'owner_override'
  )) DEFAULT 'pending_owner',
ADD COLUMN IF NOT EXISTS tenant_ack_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tenant_notes TEXT,
ADD COLUMN IF NOT EXISTS tenant_rejection_photos TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS mediation_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mediation_reason TEXT,
ADD COLUMN IF NOT EXISTS forwarded_to_tenant_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_approve_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS owner_override_reason TEXT,
ADD COLUMN IF NOT EXISTS owner_override_at TIMESTAMPTZ;

-- Create index for timeout auto-approval queries
CREATE INDEX IF NOT EXISTS idx_closure_reports_auto_approve
ON closure_reports(tenant_verification_status, auto_approve_at)
WHERE tenant_verification_status = 'pending_tenant' AND auto_approve_at IS NOT NULL;

-- Create index for mediation queries
CREATE INDEX IF NOT EXISTS idx_closure_reports_mediation
ON closure_reports(mediation_required)
WHERE mediation_required = TRUE;

-- Add RLS policies for tenant access to closure reports

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Tenants can view their closure reports" ON closure_reports;

-- Tenants can view closure reports for their maintenance requests
CREATE POLICY "Tenants can view their closure reports"
ON closure_reports FOR SELECT
TO authenticated
USING (
  maintenance_request_id IN (
    SELECT id FROM maintenance_requests WHERE tenant_id = auth.uid()
  )
);

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Tenants can update their verification" ON closure_reports;

-- Tenants can update tenant verification fields
CREATE POLICY "Tenants can update their verification"
ON closure_reports FOR UPDATE
TO authenticated
USING (
  maintenance_request_id IN (
    SELECT id FROM maintenance_requests WHERE tenant_id = auth.uid()
  )
)
WITH CHECK (
  maintenance_request_id IN (
    SELECT id FROM maintenance_requests WHERE tenant_id = auth.uid()
  )
);

-- Add comment documenting the workflow
COMMENT ON COLUMN closure_reports.tenant_verification_status IS
'Tenant verification status:
- pending_owner: Vendor submitted, waiting for owner review
- pending_tenant: Owner forwarded to tenant for verification
- tenant_approved: Tenant verified work is satisfactory
- tenant_rejected: Tenant rejected work (needs fixes)
- auto_approved: Auto-approved after 72hr timeout
- owner_override: Owner bypassed tenant verification (emergency/moved out)';

COMMENT ON COLUMN closure_reports.rejection_count IS
'Number of times tenant rejected this closure. After 3 rejections, mediation_required flag is set.';

COMMENT ON COLUMN closure_reports.auto_approve_at IS
'Timestamp when closure will be auto-approved if tenant unresponsive (72 hours after forwarded_to_tenant_at).';

COMMENT ON COLUMN closure_reports.mediation_required IS
'Flag indicating owner mediation required after 3 tenant rejections.';
