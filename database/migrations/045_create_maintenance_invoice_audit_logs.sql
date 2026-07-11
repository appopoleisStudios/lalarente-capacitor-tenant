-- Migration: Create maintenance_invoice_audit_logs table
-- Immutable audit trail for all invoice state transitions (SA requirement)
-- Provides transparent history for approval/rejection events

-- ============================================
-- Audit log table
-- ============================================
CREATE TABLE IF NOT EXISTS maintenance_invoice_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES maintenance_invoices(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX idx_invoice_audit_invoice ON maintenance_invoice_audit_logs(invoice_id);
CREATE INDEX idx_invoice_audit_actor  ON maintenance_invoice_audit_logs(actor_id);
CREATE INDEX idx_invoice_audit_event  ON maintenance_invoice_audit_logs(event);
CREATE INDEX idx_invoice_audit_created ON maintenance_invoice_audit_logs(created_at);

-- ============================================
-- RLS: Service role only for inserts; owners/vendors can read their own audit logs
-- ============================================
ALTER TABLE maintenance_invoice_audit_logs ENABLE ROW LEVEL SECURITY;

-- Owners can view audit logs for their invoices
CREATE POLICY owner_invoice_audit_select ON maintenance_invoice_audit_logs
  FOR SELECT USING (
    invoice_id IN (
      SELECT id FROM maintenance_invoices WHERE owner_id = auth.uid()
    )
  );

-- Vendors can view audit logs for their invoices
CREATE POLICY vendor_invoice_audit_select ON maintenance_invoice_audit_logs
  FOR SELECT USING (
    invoice_id IN (
      SELECT id FROM maintenance_invoices WHERE vendor_id = auth.uid()
    )
  );

-- Only service role (server-side API) can insert audit logs
-- Prevents direct client-side tampering with the audit trail
-- auth.role() returns 'service_role' only when using the service_role key (RLS bypassed)
-- For anon key requests, auth.role() returns 'authenticated' so the check fails
CREATE POLICY service_role_invoice_audit_insert ON maintenance_invoice_audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Admins can view all audit logs
CREATE POLICY admin_invoice_audit_select ON maintenance_invoice_audit_logs
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );
