-- Migration 073: Persist vendor email invitations (LAL-113)
-- Unregistered vendors can be invited by email. Never claim send without a row.

CREATE TABLE IF NOT EXISTS vendor_email_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed')),
  resend_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_email_invites_request
  ON vendor_email_invites (request_id, created_at DESC);

ALTER TABLE vendor_email_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_email_invites_select_owner ON vendor_email_invites;
CREATE POLICY vendor_email_invites_select_owner
  ON vendor_email_invites FOR SELECT
  USING (
    invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM maintenance_requests mr
      WHERE mr.id = request_id AND mr.owner_id = auth.uid()
    )
  );

COMMENT ON TABLE vendor_email_invites IS
  'LAL-113: email invites to unregistered vendors. Inserts are service-role (edge) after owner JWT check.';
