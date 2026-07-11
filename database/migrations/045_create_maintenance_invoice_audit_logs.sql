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
-- RLS: Only admins can read; inserts allowed via API
-- ============================================
ALTER TABLE maintenance_invoice_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY admin_invoice_audit_select ON maintenance_invoice_audit_logs
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Service role inserts (via API) are allowed
CREATE POLICY service_role_invoice_audit_insert ON maintenance_invoice_audit_logs
  FOR INSERT WITH CHECK (true);
