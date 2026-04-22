/**
 * POPIA Consent Management API
 *
 * Implements consent capture, withdrawal, and management per POPIA s11.
 * All consent operations are logged to the privacy_audit_log for accountability.
 */

import { supabase } from '../../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConsentType =
  | 'data_processing'
  | 'marketing_email'
  | 'marketing_sms'
  | 'marketing_push'
  | 'data_sharing_credit'
  | 'data_sharing_partners'
  | 'profiling'
  | 'location_tracking'
  | 'biometric_data';

export type CaptureMethod =
  | 'signup_checkbox'
  | 'in_app_modal'
  | 'settings_toggle'
  | 'written_form'
  | 'verbal_recorded';

export interface ConsentRecord {
  id: string;
  user_id: string;
  consent_type: ConsentType;
  status: 'active' | 'withdrawn' | 'expired';
  granted_at: string;
  withdrawn_at: string | null;
  expires_at: string | null;
  capture_method: CaptureMethod;
  privacy_notice_version: string;
  consent_text: string;
  created_at: string;
  updated_at: string;
}

export interface CaptureConsentInput {
  consentType: ConsentType;
  captureMethod: CaptureMethod;
  consentText: string;
  privacyNoticeVersion?: string;
  expiresAt?: string;
}

// Required consents that must be captured during signup
export const REQUIRED_CONSENTS: { type: ConsentType; text: string }[] = [
  {
    type: 'data_processing',
    text: 'I consent to the processing of my personal information as described in the Privacy Policy, in accordance with the Protection of Personal Information Act (POPIA).',
  },
];

// Optional consents offered during signup or in settings
export const OPTIONAL_CONSENTS: { type: ConsentType; text: string; description: string }[] = [
  {
    type: 'marketing_email',
    text: 'I consent to receiving marketing communications via email.',
    description: 'Receive property alerts, promotions, and newsletters by email.',
  },
  {
    type: 'marketing_push',
    text: 'I consent to receiving marketing push notifications.',
    description: 'Get notified about new listings and deals via push notifications.',
  },
  {
    type: 'marketing_sms',
    text: 'I consent to receiving marketing communications via SMS.',
    description: 'Receive property alerts and updates via SMS.',
  },
  {
    type: 'data_sharing_credit',
    text: 'I consent to my information being shared with credit bureaus for tenant screening purposes.',
    description: 'Allows landlords to perform credit checks on your application.',
  },
];

// ─── API ─────────────────────────────────────────────────────────────────────

export const consentApi = {
  /**
   * Capture a new consent record.
   * POPIA s11: Processing requires consent. This creates an auditable record.
   */
  async captureConsent(userId: string, input: CaptureConsentInput): Promise<ConsentRecord> {
    // Withdraw any existing active consent of the same type (replace)
    await supabase
      .from('consent_records')
      .update({
        status: 'withdrawn',
        withdrawn_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('consent_type', input.consentType)
      .eq('status', 'active');

    // Insert new consent
    const { data, error } = await supabase
      .from('consent_records')
      .insert({
        user_id: userId,
        consent_type: input.consentType,
        status: 'active',
        granted_at: new Date().toISOString(),
        capture_method: input.captureMethod,
        consent_text: input.consentText,
        privacy_notice_version: input.privacyNoticeVersion || '1.0',
        expires_at: input.expiresAt || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error capturing consent:', error);
      throw new Error(`Failed to capture consent: ${error.message}`);
    }

    // Audit log
    await this.logPrivacyAction(userId, 'consent_granted', 'consent_records', data.id, {
      consent_type: input.consentType,
      capture_method: input.captureMethod,
    });

    return data as ConsentRecord;
  },

  /**
   * Withdraw a specific consent.
   * POPIA s11(2)(b): Data subject may withdraw consent at any time.
   */
  async withdrawConsent(userId: string, consentType: ConsentType): Promise<ConsentRecord> {
    const { data, error } = await supabase
      .from('consent_records')
      .update({
        status: 'withdrawn',
        withdrawn_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('consent_type', consentType)
      .eq('status', 'active')
      .select()
      .single();

    if (error) {
      console.error('Error withdrawing consent:', error);
      throw new Error(`Failed to withdraw consent: ${error.message}`);
    }

    // Audit log
    await this.logPrivacyAction(userId, 'consent_withdrawn', 'consent_records', data.id, {
      consent_type: consentType,
    });

    return data as ConsentRecord;
  },

  /**
   * Get all active consents for a user.
   */
  async getActiveConsents(userId: string): Promise<ConsentRecord[]> {
    const { data, error } = await supabase
      .from('consent_records')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('consent_type');

    if (error) {
      console.error('Error fetching active consents:', error);
      throw new Error(`Failed to fetch active consents: ${error.message}`);
    }

    return data as ConsentRecord[];
  },

  /**
   * Get all consent records (including historical) for a user.
   */
  async getAllConsents(userId: string): Promise<ConsentRecord[]> {
    const { data, error } = await supabase
      .from('consent_records')
      .select('*')
      .eq('user_id', userId)
      .order('granted_at', { ascending: false });

    if (error) {
      console.error('Error fetching consent history:', error);
      throw new Error(`Failed to fetch consent history: ${error.message}`);
    }

    return data as ConsentRecord[];
  },

  /**
   * Check if a specific consent is active for a user.
   */
  async hasActiveConsent(userId: string, consentType: ConsentType): Promise<boolean> {
    const { data, error } = await supabase
      .from('consent_records')
      .select('id')
      .eq('user_id', userId)
      .eq('consent_type', consentType)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      console.error('Error checking consent:', error);
      return false;
    }

    return data !== null;
  },

  /**
   * Capture multiple consents at once (used during signup).
   */
  async captureMultipleConsents(
    userId: string,
    consents: CaptureConsentInput[]
  ): Promise<ConsentRecord[]> {
    const results: ConsentRecord[] = [];

    for (const consent of consents) {
      const record = await this.captureConsent(userId, consent);
      results.push(record);
    }

    return results;
  },

  /**
   * Log a privacy-related action to the immutable audit trail.
   */
  async logPrivacyAction(
    actorId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const { error } = await supabase.from('privacy_audit_log').insert({
      actor_id: actorId,
      actor_type: 'user' as const,
      action: action as any,
      target_user_id: actorId,
      resource_type: resourceType,
      resource_id: resourceId,
      details: (details || null) as any,
    });

    if (error) {
      // Don't throw - audit logging failure should not block the operation
      console.error('Error logging privacy action:', error);
    }
  },
};
