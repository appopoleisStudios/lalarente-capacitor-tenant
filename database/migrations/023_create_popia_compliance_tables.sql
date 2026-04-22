-- Migration 023: POPIA Compliance Tables
--
-- Protection of Personal Information Act 4 of 2013
-- Effective: 1 July 2021 | Enforcement: 1 July 2021
--
-- Non-compliance risk: Up to R10 million fine + criminal liability
--
-- Tables created:
--   consent_records       - Tracks all data processing consent (POPIA s11)
--   data_access_requests  - DSAR: Access requests (POPIA s23)
--   data_correction_requests - DSAR: Correction requests (POPIA s24)
--   data_deletion_requests   - DSAR: Deletion requests (POPIA s24)
--   retention_policies    - Data retention schedules (POPIA s14)
--   privacy_audit_log     - Immutable audit trail (POPIA s19)

BEGIN;

-- ─── 1. Consent Records ─────────────────────────────────────────────────────
-- POPIA s11: Personal information may only be processed if the data subject
-- consents to the processing.

CREATE TABLE IF NOT EXISTS consent_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- What they consented to
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'data_processing',        -- General data processing (required)
    'marketing_email',        -- Email marketing communications
    'marketing_sms',          -- SMS marketing communications
    'marketing_push',         -- Push notification marketing
    'data_sharing_credit',    -- Share data with credit bureaus
    'data_sharing_partners',  -- Share data with partner services
    'profiling',              -- Automated decision-making / profiling
    'location_tracking',      -- Location data collection
    'biometric_data'          -- Fingerprint, face ID usage
  )),

  -- Consent status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'expired')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- How consent was captured (evidence trail)
  capture_method TEXT NOT NULL CHECK (capture_method IN (
    'signup_checkbox',        -- During registration
    'in_app_modal',           -- In-app consent modal
    'settings_toggle',        -- From privacy settings
    'written_form',           -- Physical written consent
    'verbal_recorded'         -- Verbal consent (recorded)
  )),

  -- POPIA s18: Notice given at time of consent
  privacy_notice_version TEXT NOT NULL DEFAULT '1.0',
  consent_text TEXT NOT NULL, -- Exact wording shown to user

  -- Device / IP for evidence
  ip_address INET,
  user_agent TEXT,
  device_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consent_user ON consent_records (user_id);
CREATE INDEX idx_consent_type ON consent_records (consent_type);
CREATE INDEX idx_consent_status ON consent_records (status);
CREATE UNIQUE INDEX idx_consent_user_type_active ON consent_records (user_id, consent_type)
  WHERE status = 'active';

-- ─── 2. Data Access Requests (DSAR - POPIA s23) ─────────────────────────────
-- Data subjects have the right to request access to their personal information.
-- Must be responded to within 30 business days.

CREATE TABLE IF NOT EXISTS data_access_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Request details
  request_type TEXT NOT NULL DEFAULT 'access' CHECK (request_type IN ('access', 'portability')),
  description TEXT, -- What data they're requesting
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Received, not yet processed
    'processing',   -- Being compiled
    'completed',    -- Data export ready
    'rejected',     -- Rejected with reason
    'overdue'       -- Past 30 business day deadline
  )),

  -- Response tracking
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at TIMESTAMPTZ NOT NULL, -- 30 business days from received_at
  responded_at TIMESTAMPTZ,
  response_notes TEXT,

  -- Data export
  export_file_url TEXT,
  export_format TEXT CHECK (export_format IN ('json', 'csv', 'pdf')),
  export_generated_at TIMESTAMPTZ,

  -- Rejection (must be legally justified)
  rejection_reason TEXT,

  -- Identity verification (must verify requestor)
  identity_verified BOOLEAN DEFAULT FALSE,
  verification_method TEXT,
  verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dsar_access_user ON data_access_requests (user_id);
CREATE INDEX idx_dsar_access_status ON data_access_requests (status);
CREATE INDEX idx_dsar_access_deadline ON data_access_requests (deadline_at);

-- ─── 3. Data Correction Requests (POPIA s24) ────────────────────────────────
-- Data subjects may request correction of personal information.

CREATE TABLE IF NOT EXISTS data_correction_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- What to correct
  field_name TEXT NOT NULL,       -- e.g. 'full_name', 'email', 'phone'
  current_value TEXT,             -- Current stored value
  requested_value TEXT NOT NULL,  -- What they want it changed to
  justification TEXT,             -- Why the correction is needed

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'completed'
  )),

  -- Processing
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dsar_correction_user ON data_correction_requests (user_id);
CREATE INDEX idx_dsar_correction_status ON data_correction_requests (status);

-- ─── 4. Data Deletion Requests (POPIA s24(1)(d)) ────────────────────────────
-- Data subjects may request deletion/destruction of personal information.
-- Exception: Required retention (tax records, active leases, etc.)

CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Request details
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN (
    'all',              -- Delete everything
    'marketing',        -- Only marketing-related data
    'specific_data',    -- Specific data categories
    'account'           -- Full account deletion
  )),
  specific_categories TEXT[], -- If scope = 'specific_data'
  reason TEXT,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',          -- Received
    'under_review',     -- Checking retention obligations
    'partial_approved', -- Some data can be deleted, some retained
    'approved',         -- Full deletion approved
    'completed',        -- Deletion executed
    'rejected'          -- Cannot delete (retention obligation)
  )),

  -- Retention check
  retention_check_notes TEXT,  -- What data must be retained and why
  data_retained JSONB,         -- List of data categories retained with legal basis

  -- Processing
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Confirmation
  deletion_certificate_url TEXT, -- Proof of deletion

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dsar_deletion_user ON data_deletion_requests (user_id);
CREATE INDEX idx_dsar_deletion_status ON data_deletion_requests (status);

-- ─── 5. Retention Policies (POPIA s14) ──────────────────────────────────────
-- Personal information must not be retained longer than necessary.

CREATE TABLE IF NOT EXISTS retention_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  data_category TEXT NOT NULL UNIQUE,   -- e.g. 'rejected_applications', 'active_leases'
  description TEXT NOT NULL,
  retention_days INTEGER NOT NULL,       -- How long to retain in days
  legal_basis TEXT NOT NULL,             -- Legal justification for retention
  auto_delete BOOLEAN DEFAULT FALSE,     -- Whether to auto-delete after retention period
  notify_before_delete_days INTEGER DEFAULT 7, -- Notification before auto-delete

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 6. Privacy Audit Log (POPIA s19) ───────────────────────────────────────
-- Immutable log of all privacy-related actions for accountability.

CREATE TABLE IF NOT EXISTS privacy_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Who
  actor_id UUID REFERENCES profiles(id),  -- NULL for system actions
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'admin', 'system', 'automated')),

  -- What
  action TEXT NOT NULL CHECK (action IN (
    'consent_granted',
    'consent_withdrawn',
    'data_accessed',
    'data_exported',
    'data_corrected',
    'data_deleted',
    'dsar_submitted',
    'dsar_responded',
    'dsar_overdue',
    'retention_applied',
    'privacy_notice_updated',
    'breach_detected',
    'breach_reported'
  )),

  -- Context
  target_user_id UUID REFERENCES profiles(id), -- Whose data was affected
  resource_type TEXT,    -- e.g. 'consent_records', 'profiles'
  resource_id UUID,      -- ID of the affected record
  details JSONB,         -- Additional context

  -- Immutability
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
  -- No updated_at: audit logs are immutable
);

CREATE INDEX idx_privacy_audit_actor ON privacy_audit_log (actor_id);
CREATE INDEX idx_privacy_audit_target ON privacy_audit_log (target_user_id);
CREATE INDEX idx_privacy_audit_action ON privacy_audit_log (action);
CREATE INDEX idx_privacy_audit_created ON privacy_audit_log (created_at);

-- ─── RLS Policies ───────────────────────────────────────────────────────────

-- Consent Records
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own consent records"
  ON consent_records FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own consent records"
  ON consent_records FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own consent records"
  ON consent_records FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Data Access Requests
ALTER TABLE data_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own access requests"
  ON data_access_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create access requests"
  ON data_access_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Data Correction Requests
ALTER TABLE data_correction_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own correction requests"
  ON data_correction_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create correction requests"
  ON data_correction_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Data Deletion Requests
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deletion requests"
  ON data_deletion_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create deletion requests"
  ON data_deletion_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Retention Policies (read-only for all authenticated users)
ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view retention policies"
  ON retention_policies FOR SELECT
  TO authenticated
  USING (true);

-- Privacy Audit Log (users can only see entries about themselves)
ALTER TABLE privacy_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit entries about themselves"
  ON privacy_audit_log FOR SELECT
  TO authenticated
  USING (target_user_id = auth.uid() OR actor_id = auth.uid());

-- ─── Seed Retention Policies ────────────────────────────────────────────────

INSERT INTO retention_policies (data_category, description, retention_days, legal_basis, auto_delete) VALUES
  ('rejected_applications', 'Tenant applications that were rejected', 90, 'No ongoing legitimate interest after rejection. POPIA s14(1).', TRUE),
  ('withdrawn_applications', 'Tenant applications that were withdrawn', 30, 'No purpose after withdrawal. POPIA s14(1).', TRUE),
  ('expired_viewings', 'Viewing requests that have expired', 90, 'No ongoing legitimate interest. POPIA s14(1).', TRUE),
  ('active_leases', 'Lease agreements currently active', 0, 'Required for contractual obligation. POPIA s11(1)(e). Retain while active.', FALSE),
  ('terminated_leases', 'Lease agreements that have ended', 1825, 'Prescription Act: 5-year limitation period for contractual claims.', FALSE),
  ('payment_records', 'All payment transaction records', 1825, 'Tax legislation (Income Tax Act s73): 5-year retention for financial records.', FALSE),
  ('maintenance_records', 'Maintenance request history', 1825, 'Prescription Act: 5-year limitation for property damage claims.', FALSE),
  ('user_profiles', 'User profile information', 0, 'Required while account is active. POPIA s11(1)(e).', FALSE),
  ('messages', 'In-app messages between parties', 365, 'Retain 1 year for dispute resolution. POPIA s14(1).', TRUE),
  ('inspection_reports', 'Property inspection records', 1825, 'Prescription Act: 5-year limitation for deposit disputes.', FALSE),
  ('consent_records', 'Records of consent granted/withdrawn', 1825, 'Must retain proof of consent for 5 years. POPIA s19.', FALSE),
  ('audit_logs', 'Privacy and compliance audit trail', 2555, 'Regulatory requirement: 7-year retention for compliance evidence.', FALSE)
ON CONFLICT (data_category) DO NOTHING;

-- ─── Triggers ───────────────────────────────────────────────────────────────

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_privacy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consent_records_updated_at
  BEFORE UPDATE ON consent_records
  FOR EACH ROW EXECUTE FUNCTION update_privacy_updated_at();

CREATE TRIGGER data_access_requests_updated_at
  BEFORE UPDATE ON data_access_requests
  FOR EACH ROW EXECUTE FUNCTION update_privacy_updated_at();

CREATE TRIGGER data_correction_requests_updated_at
  BEFORE UPDATE ON data_correction_requests
  FOR EACH ROW EXECUTE FUNCTION update_privacy_updated_at();

CREATE TRIGGER data_deletion_requests_updated_at
  BEFORE UPDATE ON data_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION update_privacy_updated_at();

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ POPIA compliance tables created. R10M fine risk mitigated.';
END $$;
