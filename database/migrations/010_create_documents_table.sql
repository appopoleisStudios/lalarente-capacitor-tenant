-- Migration: Create documents table
-- Task: 1.10 Create documents table
-- Requirements: 19
-- Date: 2025-11-01

BEGIN;

-- Create documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  type TEXT NOT NULL CHECK (type IN ('lease', 'inspection', 'receipt', 'id', 'proof_of_income', 'reference', 'other')),
  
  property_id UUID REFERENCES properties(id),
  lease_id UUID REFERENCES leases(id),
  tenant_id UUID REFERENCES profiles(id),
  owner_id UUID REFERENCES profiles(id),
  
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  mime_type TEXT NOT NULL,
  
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  
  encrypted BOOLEAN DEFAULT false,
  access_level TEXT NOT NULL CHECK (access_level IN ('public', 'parties_only', 'owner_only', 'tenant_only')),
  
  retention_period_years INTEGER NOT NULL CHECK (retention_period_years > 0),
  delete_after DATE,
  
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  last_accessed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_property ON documents(property_id);
CREATE INDEX idx_documents_lease ON documents(lease_id);
CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_delete_after ON documents(delete_after);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);

COMMENT ON TABLE documents IS 'Rental documents with access control and retention';

-- Create document_access_log table
CREATE TABLE document_access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  accessed_by UUID NOT NULL REFERENCES profiles(id),
  
  ip_address INET,
  user_agent TEXT,
  
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_document_access_log_document ON document_access_log(document_id);
CREATE INDEX idx_document_access_log_user ON document_access_log(accessed_by);
CREATE INDEX idx_document_access_log_accessed_at ON document_access_log(accessed_at);

COMMENT ON TABLE document_access_log IS 'Audit log of document access';

-- Create property_waitlist table
CREATE TABLE property_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  
  notification_email BOOLEAN DEFAULT true,
  notification_sms BOOLEAN DEFAULT false,
  
  position INTEGER,
  notified_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'notified', 'responded', 'expired', 'removed')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(property_id, tenant_id)
);

CREATE INDEX idx_property_waitlist_property ON property_waitlist(property_id);
CREATE INDEX idx_property_waitlist_tenant ON property_waitlist(tenant_id);
CREATE INDEX idx_property_waitlist_position ON property_waitlist(property_id, position);

COMMENT ON TABLE property_waitlist IS 'Tenant waitlist for properties';

-- Helper functions
CREATE OR REPLACE FUNCTION calculate_document_delete_after(
  p_retention_years INTEGER,
  p_created_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS DATE AS $$
BEGIN
  RETURN (p_created_at + (p_retention_years || ' years')::INTERVAL)::DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION set_document_delete_after()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.delete_after IS NULL THEN
    NEW.delete_after = calculate_document_delete_after(NEW.retention_period_years, NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_document_delete_after_trigger ON documents;
CREATE TRIGGER set_document_delete_after_trigger
  BEFORE INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION set_document_delete_after();

CREATE OR REPLACE FUNCTION log_document_access(
  p_document_id UUID,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO document_access_log (
    document_id,
    accessed_by,
    ip_address,
    user_agent
  ) VALUES (
    p_document_id,
    auth.uid(),
    p_ip_address,
    p_user_agent
  );
  
  UPDATE documents
  SET last_accessed_at = NOW()
  WHERE id = p_document_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
