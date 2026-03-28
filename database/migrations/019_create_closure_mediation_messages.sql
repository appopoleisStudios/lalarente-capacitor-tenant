-- Migration 019: Create closure mediation messages table
-- This enables dispute resolution communication between owner, tenant, and vendor
-- Run this in Supabase SQL Editor

-- Create closure_mediation_messages table
CREATE TABLE IF NOT EXISTS closure_mediation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_report_id UUID NOT NULL REFERENCES closure_reports(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('owner', 'tenant', 'vendor')),
  message TEXT NOT NULL,
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_mediation_messages_closure
ON closure_mediation_messages(closure_report_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mediation_messages_sender
ON closure_mediation_messages(sender_id);

-- Enable Row Level Security
ALTER TABLE closure_mediation_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mediation messages

-- Owners can view all mediation messages for their properties
CREATE POLICY "Owners can view mediation messages"
ON closure_mediation_messages FOR SELECT
TO authenticated
USING (
  closure_report_id IN (
    SELECT cr.id FROM closure_reports cr
    JOIN maintenance_requests mr ON cr.maintenance_request_id = mr.id
    WHERE mr.owner_id = auth.uid()
  )
);

-- Tenants can view mediation messages for their requests
CREATE POLICY "Tenants can view mediation messages"
ON closure_mediation_messages FOR SELECT
TO authenticated
USING (
  closure_report_id IN (
    SELECT cr.id FROM closure_reports cr
    JOIN maintenance_requests mr ON cr.maintenance_request_id = mr.id
    WHERE mr.tenant_id = auth.uid()
  )
);

-- Vendors can view mediation messages for their assigned jobs
CREATE POLICY "Vendors can view mediation messages"
ON closure_mediation_messages FOR SELECT
TO authenticated
USING (
  closure_report_id IN (
    SELECT cr.id FROM closure_reports cr
    JOIN maintenance_requests mr ON cr.maintenance_request_id = mr.id
    WHERE mr.selected_vendor_id = auth.uid()
  )
);

-- Owners can insert mediation messages
CREATE POLICY "Owners can add mediation messages"
ON closure_mediation_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  sender_role = 'owner' AND
  closure_report_id IN (
    SELECT cr.id FROM closure_reports cr
    JOIN maintenance_requests mr ON cr.maintenance_request_id = mr.id
    WHERE mr.owner_id = auth.uid()
  )
);

-- Tenants can insert mediation messages
CREATE POLICY "Tenants can add mediation messages"
ON closure_mediation_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  sender_role = 'tenant' AND
  closure_report_id IN (
    SELECT cr.id FROM closure_reports cr
    JOIN maintenance_requests mr ON cr.maintenance_request_id = mr.id
    WHERE mr.tenant_id = auth.uid()
  )
);

-- Vendors can insert mediation messages
CREATE POLICY "Vendors can add mediation messages"
ON closure_mediation_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  sender_role = 'vendor' AND
  closure_report_id IN (
    SELECT cr.id FROM closure_reports cr
    JOIN maintenance_requests mr ON cr.maintenance_request_id = mr.id
    WHERE mr.selected_vendor_id = auth.uid()
  )
);

-- Enable realtime for mediation messages (for live chat-like experience)
ALTER PUBLICATION supabase_realtime ADD TABLE closure_mediation_messages;

-- Add comments documenting the table
COMMENT ON TABLE closure_mediation_messages IS
'Mediation messages for dispute resolution when tenant rejects completed work multiple times.
Enables communication between owner, tenant, and vendor to resolve conflicts transparently.';

COMMENT ON COLUMN closure_mediation_messages.sender_role IS
'Role of the message sender: owner (property owner), tenant (requesting tenant), or vendor (assigned vendor).';

COMMENT ON COLUMN closure_mediation_messages.photos IS
'Optional photos attached to the message for providing evidence or clarification.';
