/**
 * POPIA Data Subject Rights (DSAR) API
 *
 * Implements the rights granted to data subjects under POPIA:
 * - s23: Right of access to personal information
 * - s24: Right to correction/deletion of personal information
 * - 30 business day response deadline
 */

import { supabase } from '../../../lib/supabase';
import { calculateDSARDeadline, toDateString } from '../../../shared/utils/businessDayCalculator';
import { consentApi } from './consent.api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DataAccessRequest {
  id: string;
  user_id: string;
  request_type: 'access' | 'portability';
  description: string | null;
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'overdue';
  received_at: string;
  deadline_at: string;
  responded_at: string | null;
  response_notes: string | null;
  export_file_url: string | null;
  export_format: 'json' | 'csv' | 'pdf' | null;
  export_generated_at: string | null;
  rejection_reason: string | null;
  identity_verified: boolean;
  verification_method: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataCorrectionRequest {
  id: string;
  user_id: string;
  field_name: string;
  current_value: string | null;
  requested_value: string;
  justification: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataDeletionRequest {
  id: string;
  user_id: string;
  scope: 'all' | 'marketing' | 'specific_data' | 'account';
  specific_categories: string[] | null;
  reason: string | null;
  status: 'pending' | 'under_review' | 'partial_approved' | 'approved' | 'completed' | 'rejected';
  retention_check_notes: string | null;
  data_retained: Record<string, string> | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  executed_at: string | null;
  rejection_reason: string | null;
  deletion_certificate_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserDataExport {
  profile: Record<string, unknown>;
  consents: Record<string, unknown>[];
  leases: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  applications: Record<string, unknown>[];
  maintenanceRequests: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  viewings: Record<string, unknown>[];
  exportedAt: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const dataSubjectRightsApi = {
  // ── Access Requests (POPIA s23) ────────────────────────────────────────────

  /**
   * Submit a data access request.
   * Deadline is automatically set to 30 business days per POPIA s23.
   */
  async submitAccessRequest(
    userId: string,
    requestType: 'access' | 'portability' = 'access',
    description?: string
  ): Promise<DataAccessRequest> {
    const now = new Date();
    const deadline = calculateDSARDeadline(now);

    const { data, error } = await supabase
      .from('data_access_requests')
      .insert({
        user_id: userId,
        request_type: requestType,
        description: description || null,
        status: 'pending',
        received_at: now.toISOString(),
        deadline_at: deadline.toISOString(),
        identity_verified: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error submitting access request:', error);
      throw new Error(`Failed to submit access request: ${error.message}`);
    }

    await consentApi.logPrivacyAction(userId, 'dsar_submitted', 'data_access_requests', data.id, {
      request_type: requestType,
      deadline: toDateString(deadline),
    });

    return data as DataAccessRequest;
  },

  /**
   * Get all access requests for a user.
   */
  async getAccessRequests(userId: string): Promise<DataAccessRequest[]> {
    const { data, error } = await supabase
      .from('data_access_requests')
      .select('*')
      .eq('user_id', userId)
      .order('received_at', { ascending: false });

    if (error) {
      console.error('Error fetching access requests:', error);
      throw new Error(`Failed to fetch access requests: ${error.message}`);
    }

    return data as DataAccessRequest[];
  },

  /**
   * Generate a complete data export for a user (POPIA s23 response).
   * Collects all personal information stored across all tables.
   */
  async generateUserDataExport(userId: string): Promise<UserDataExport> {
    // Fetch all user data in parallel
    const [
      profileResult,
      consentsResult,
      leasesResult,
      paymentsResult,
      applicationsResult,
      maintenanceResult,
      messagesResult,
      viewingsResult,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('consent_records').select('*').eq('user_id', userId),
      supabase.from('leases').select('*').or(`tenant_id.eq.${userId},owner_id.eq.${userId}`),
      supabase.from('payments').select('*').or(`tenant_id.eq.${userId},owner_id.eq.${userId}`),
      supabase.from('rental_applications').select('*').eq('tenant_id', userId),
      supabase.from('maintenance_requests').select('*').or(`tenant_id.eq.${userId},owner_id.eq.${userId}`),
      supabase.from('messages').select('*').eq('sender_id', userId),
      supabase.from('viewing_requests').select('*').eq('tenant_id', userId),
    ]);

    const exportData: UserDataExport = {
      profile: profileResult.data || {},
      consents: consentsResult.data || [],
      leases: leasesResult.data || [],
      payments: paymentsResult.data || [],
      applications: applicationsResult.data || [],
      maintenanceRequests: maintenanceResult.data || [],
      messages: messagesResult.data || [],
      viewings: viewingsResult.data || [],
      exportedAt: new Date().toISOString(),
    };

    await consentApi.logPrivacyAction(userId, 'data_exported', 'profiles', userId, {
      tables_exported: Object.keys(exportData).length,
    });

    return exportData;
  },

  // ── Correction Requests (POPIA s24) ────────────────────────────────────────

  /**
   * Submit a data correction request.
   */
  async submitCorrectionRequest(
    userId: string,
    fieldName: string,
    currentValue: string | null,
    requestedValue: string,
    justification?: string
  ): Promise<DataCorrectionRequest> {
    const { data, error } = await supabase
      .from('data_correction_requests')
      .insert({
        user_id: userId,
        field_name: fieldName,
        current_value: currentValue,
        requested_value: requestedValue,
        justification: justification || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error submitting correction request:', error);
      throw new Error(`Failed to submit correction request: ${error.message}`);
    }

    await consentApi.logPrivacyAction(userId, 'dsar_submitted', 'data_correction_requests', data.id, {
      field: fieldName,
    });

    return data as DataCorrectionRequest;
  },

  /**
   * Get all correction requests for a user.
   */
  async getCorrectionRequests(userId: string): Promise<DataCorrectionRequest[]> {
    const { data, error } = await supabase
      .from('data_correction_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching correction requests:', error);
      throw new Error(`Failed to fetch correction requests: ${error.message}`);
    }

    return data as DataCorrectionRequest[];
  },

  // ── Deletion Requests (POPIA s24(1)(d)) ────────────────────────────────────

  /**
   * Submit a data deletion request.
   * Note: Certain data may be retained per legal obligation (retention policies).
   */
  async submitDeletionRequest(
    userId: string,
    scope: 'all' | 'marketing' | 'specific_data' | 'account',
    reason?: string,
    specificCategories?: string[]
  ): Promise<DataDeletionRequest> {
    const { data, error } = await supabase
      .from('data_deletion_requests')
      .insert({
        user_id: userId,
        scope,
        reason: reason || null,
        specific_categories: specificCategories || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error submitting deletion request:', error);
      throw new Error(`Failed to submit deletion request: ${error.message}`);
    }

    await consentApi.logPrivacyAction(userId, 'dsar_submitted', 'data_deletion_requests', data.id, {
      scope,
      specific_categories: specificCategories,
    });

    return data as DataDeletionRequest;
  },

  /**
   * Get all deletion requests for a user.
   */
  async getDeletionRequests(userId: string): Promise<DataDeletionRequest[]> {
    const { data, error } = await supabase
      .from('data_deletion_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching deletion requests:', error);
      throw new Error(`Failed to fetch deletion requests: ${error.message}`);
    }

    return data as DataDeletionRequest[];
  },

  // ── Dashboard / Summary ────────────────────────────────────────────────────

  /**
   * Get a summary of all DSAR activity for a user.
   */
  async getDSARSummary(userId: string): Promise<{
    accessRequests: DataAccessRequest[];
    correctionRequests: DataCorrectionRequest[];
    deletionRequests: DataDeletionRequest[];
    pendingCount: number;
  }> {
    const [accessRequests, correctionRequests, deletionRequests] = await Promise.all([
      this.getAccessRequests(userId),
      this.getCorrectionRequests(userId),
      this.getDeletionRequests(userId),
    ]);

    const pendingCount =
      accessRequests.filter((r) => r.status === 'pending' || r.status === 'processing').length +
      correctionRequests.filter((r) => r.status === 'pending').length +
      deletionRequests.filter((r) => r.status === 'pending' || r.status === 'under_review').length;

    return {
      accessRequests,
      correctionRequests,
      deletionRequests,
      pendingCount,
    };
  },

  /**
   * Get the privacy audit log for a user.
   */
  async getAuditLog(
    userId: string,
    limit: number = 50
  ): Promise<Array<{ id: string; action: string; details: Record<string, unknown> | null; created_at: string }>> {
    const { data, error } = await supabase
      .from('privacy_audit_log')
      .select('id, action, details, created_at')
      .eq('target_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching audit log:', error);
      throw new Error(`Failed to fetch audit log: ${error.message}`);
    }

    return data as any;
  },
};
