-- ============================================
-- REVISION TRACKING SYSTEM MIGRATION
-- ============================================
-- This migration adds revision tracking for quotes and purchase orders
-- to enable transparent dispute resolution similar to UrbanClap/Uber

-- ============================================
-- 1. CREATE REVISION TABLES
-- ============================================

-- Quote Revisions Table
CREATE TABLE IF NOT EXISTS quote_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  subtotal DECIMAL(10,2),
  vat_amount DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  notes TEXT,
  revised_by UUID NOT NULL REFERENCES profiles(id),
  revision_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique revision numbers per quote
  CONSTRAINT unique_quote_revision UNIQUE (quote_id, revision_number)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quote_revisions_quote_id ON quote_revisions(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_revisions_created_at ON quote_revisions(created_at DESC);

-- Purchase Order Revisions Table
CREATE TABLE IF NOT EXISTS po_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  subtotal DECIMAL(10,2),
  vat_amount DECIMAL(10,2),
  platform_fee_amount DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  revised_by UUID NOT NULL REFERENCES profiles(id),
  revision_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique revision numbers per PO
  CONSTRAINT unique_po_revision UNIQUE (po_id, revision_number)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_po_revisions_po_id ON po_revisions(po_id);
CREATE INDEX IF NOT EXISTS idx_po_revisions_created_at ON po_revisions(created_at DESC);

-- ============================================
-- 2. ADD COLUMNS TO EXISTING TABLES
-- ============================================

-- Add revision tracking columns to quotes table
ALTER TABLE quotes 
  ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revision_reason TEXT;

-- Add revision tracking columns to purchase_orders table
ALTER TABLE purchase_orders 
  ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS revision_reason TEXT;

-- ============================================
-- 3. UPDATE QUOTE STATUS ENUM (if using enum type)
-- ============================================
-- Note: If you're using a CHECK constraint instead of enum, skip this section

-- First, check if the status column uses an enum type
-- If it does, you'll need to add the new status value
-- Uncomment and run if using enum:

-- ALTER TYPE quote_status_enum ADD VALUE IF NOT EXISTS 'revision_requested';

-- If using CHECK constraint instead, update it:
-- ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
-- ALTER TABLE quotes ADD CONSTRAINT quotes_status_check 
--   CHECK (status IN ('requested', 'submitted', 'approved', 'rejected', 'revision_requested'));

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on revision tables
ALTER TABLE quote_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_revisions ENABLE ROW LEVEL SECURITY;

-- Quote Revisions Policies
-- Vendors and owners can view revisions for their quotes
CREATE POLICY "Users can view quote revisions for their quotes"
  ON quote_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_revisions.quote_id
      AND (q.vendor_id = auth.uid() OR q.owner_id = auth.uid())
    )
  );

-- Only the system (service role) can insert revisions
CREATE POLICY "System can insert quote revisions"
  ON quote_revisions FOR INSERT
  WITH CHECK (true);

-- PO Revisions Policies
-- Owners can view PO revisions for their properties
CREATE POLICY "Owners can view PO revisions"
  ON po_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      JOIN maintenance_requests mr ON mr.po_id = po.id
      WHERE po.id = po_revisions.po_id
      AND mr.owner_id = auth.uid()
    )
  );

-- Vendors can view PO revisions for their work
CREATE POLICY "Vendors can view PO revisions"
  ON po_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      JOIN maintenance_requests mr ON mr.po_id = po.id
      WHERE po.id = po_revisions.po_id
      AND mr.vendor_id = auth.uid()
    )
  );

-- Only the system (service role) can insert PO revisions
CREATE POLICY "System can insert PO revisions"
  ON po_revisions FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 5. HELPER FUNCTIONS (OPTIONAL)
-- ============================================

-- Function to get the latest revision number for a quote
CREATE OR REPLACE FUNCTION get_latest_quote_revision(p_quote_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT MAX(revision_number) FROM quote_revisions WHERE quote_id = p_quote_id),
    0
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get the latest revision number for a PO
CREATE OR REPLACE FUNCTION get_latest_po_revision(p_po_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT MAX(revision_number) FROM po_revisions WHERE po_id = p_po_id),
    1
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE quote_revisions IS 'Stores historical revisions of quotes for audit trail and dispute resolution';
COMMENT ON TABLE po_revisions IS 'Stores historical revisions of purchase orders for audit trail and dispute resolution';

COMMENT ON COLUMN quotes.revision_number IS 'Current revision number, incremented with each edit';
COMMENT ON COLUMN quotes.revision_reason IS 'Reason for the last revision';

COMMENT ON COLUMN purchase_orders.revision_number IS 'Current revision number, starts at 1, incremented with each edit';
COMMENT ON COLUMN purchase_orders.revision_reason IS 'Reason for the last revision';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Run this migration in your Supabase SQL editor
-- 2. Verify tables and columns are created
-- 3. Test the revision tracking APIs
-- 4. Update your UI to display revision history
