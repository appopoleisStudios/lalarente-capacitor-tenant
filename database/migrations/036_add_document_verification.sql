-- Migration 036: Add verification columns to documents table
-- Enables admin review workflow for tenant verification documents.
-- Default 'verified' = auto-accepted (user requirement); admin can reject later.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
