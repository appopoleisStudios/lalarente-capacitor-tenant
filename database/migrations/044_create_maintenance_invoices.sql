-- Migration: Create maintenance_invoices table
-- Vendor invoices for completed maintenance work

CREATE TABLE IF NOT EXISTS maintenance_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Invoice metadata
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'approved', 'rejected', 'paid', 'cancelled')),

  -- Line items are stored as JSONB for flexibility
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Totals (calculated from line items but stored for query performance)
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,

  -- Approval
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,

  -- Payment
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,

  -- Timestamps
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_maintenance_invoices_request ON maintenance_invoices(maintenance_request_id);
CREATE INDEX idx_maintenance_invoices_vendor ON maintenance_invoices(vendor_id);
CREATE INDEX idx_maintenance_invoices_owner ON maintenance_invoices(owner_id);
CREATE INDEX idx_maintenance_invoices_status ON maintenance_invoices(status);

-- Enable RLS
ALTER TABLE maintenance_invoices ENABLE ROW LEVEL SECURITY;

-- RLS: Vendors can view and create their own invoices
CREATE POLICY vendor_invoice_select ON maintenance_invoices
  FOR SELECT USING (vendor_id = auth.uid());

CREATE POLICY vendor_invoice_insert ON maintenance_invoices
  FOR INSERT WITH CHECK (vendor_id = auth.uid());

-- RLS: Owners can view and update invoices for their properties
CREATE POLICY owner_invoice_select ON maintenance_invoices
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY owner_invoice_update ON maintenance_invoices
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
