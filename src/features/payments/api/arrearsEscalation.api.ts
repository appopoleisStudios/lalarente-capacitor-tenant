/**
 * Arrears Escalation API
 *
 * Implements the legal arrears process per CPA s14:
 * Stage 1: Friendly reminder (7 days overdue)
 * Stage 2: Formal demand (14 days overdue)
 * Stage 3: Breach notice (21 days) + 20 business day cure period
 * Stage 4: Legal action (post cure period)
 */

import { supabase } from '../../../lib/supabase';
import {
  calculateCurePeriodDeadline,
  calculateLegalInterest,
} from '../../../shared/utils/businessDayCalculator';

// ─── Types ───────────────────────────────────────────────────────────────────

export type EscalationStage =
  | 'friendly_reminder'
  | 'formal_demand'
  | 'breach_notice'
  | 'cure_period'
  | 'legal_action'
  | 'eviction_notice'
  | 'resolved';

export interface ArrearsEscalation {
  id: string;
  payment_id: string;
  lease_id: string;
  tenant_id: string;
  owner_id: string;
  property_id: string;
  stage: EscalationStage;
  amount_owed: number;
  interest_accrued: number;
  total_owed: number;
  escalated_at: string;
  cure_period_starts_at: string | null;
  cure_period_ends_at: string | null;
  resolved_at: string | null;
  notification_sent: boolean;
  notification_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EscalationSummary {
  escalations: ArrearsEscalation[];
  totalOwed: number;
  totalInterest: number;
  highestStage: EscalationStage | null;
  tenantsInArrears: number;
}

// ─── Escalation Rules ────────────────────────────────────────────────────────

const ESCALATION_THRESHOLDS = {
  friendly_reminder: 7,  // days overdue
  formal_demand: 14,
  breach_notice: 21,
} as const;

// ─── Pure Helpers ────────────────────────────────────────────────────────────

/**
 * Calculate the number of calendar days a payment is overdue.
 */
export function calculateDaysOverdue(dueDate: string): number {
  return Math.floor(
    (Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
  );
}

/**
 * Determine the escalation stage based on days overdue.
 * Returns null if below the minimum threshold.
 */
export function determineEscalationStage(daysOverdue: number): EscalationStage | null {
  if (daysOverdue < ESCALATION_THRESHOLDS.friendly_reminder) return null;
  if (daysOverdue >= ESCALATION_THRESHOLDS.breach_notice) return 'breach_notice';
  if (daysOverdue >= ESCALATION_THRESHOLDS.formal_demand) return 'formal_demand';
  return 'friendly_reminder';
}

/**
 * Check if transitioning to a new stage would be a downgrade.
 * Stages are ordered: friendly_reminder < formal_demand < breach_notice < cure_period < legal_action < eviction_notice
 */
export function isDowngrade(currentStage: EscalationStage, newStage: EscalationStage): boolean {
  const stageOrder: EscalationStage[] = [
    'friendly_reminder', 'formal_demand', 'breach_notice',
    'cure_period', 'legal_action', 'eviction_notice',
  ];
  return stageOrder.indexOf(newStage) < stageOrder.indexOf(currentStage);
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const arrearsEscalationApi = {
  /**
   * Check a payment and create/escalate arrears as needed.
   * Called periodically or when a payment becomes overdue.
   */
  async evaluatePayment(paymentId: string): Promise<ArrearsEscalation | null> {
    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .select('*, lease:leases!lease_id(interest_on_arrears_rate)')
      .eq('id', paymentId)
      .single();

    if (payErr || !payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'pending') return null;

    const daysOverdue = calculateDaysOverdue(payment.due_date);
    const stage = determineEscalationStage(daysOverdue);

    if (!stage) return null;

    // Calculate interest
    const rate = (payment.lease as any)?.interest_on_arrears_rate ?? 2.0;
    const interest = calculateLegalInterest(payment.amount, rate, daysOverdue);

    // Check for existing escalation
    const { data: existing } = await supabase
      .from('arrears_escalations')
      .select('*')
      .eq('payment_id', paymentId)
      .order('escalated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Don't downgrade an escalation
    if (existing && !isDowngrade(existing.stage as EscalationStage, stage)) {
      // Update interest but don't change stage
      await supabase
        .from('arrears_escalations')
        .update({
          interest_accrued: interest,
          total_owed: payment.amount + interest,
        })
        .eq('id', existing.id);

      return { ...existing, interest_accrued: interest, total_owed: payment.amount + interest } as ArrearsEscalation;
    }

    // Create new escalation record
    const escalation: Record<string, unknown> = {
      payment_id: paymentId,
      lease_id: payment.lease_id,
      tenant_id: payment.tenant_id,
      owner_id: payment.owner_id,
      property_id: payment.property_id,
      stage,
      amount_owed: payment.amount,
      interest_accrued: interest,
      total_owed: payment.amount + interest,
    };

    // If breach notice, set cure period
    if (stage === 'breach_notice') {
      const cureStart = new Date();
      const cureEnd = calculateCurePeriodDeadline(cureStart);
      escalation.cure_period_starts_at = cureStart.toISOString();
      escalation.cure_period_ends_at = cureEnd.toISOString();
    }

    const { data, error } = await supabase
      .from('arrears_escalations')
      .insert(escalation as any)
      .select()
      .single();

    if (error) {
      console.error('Error creating escalation:', error);
      throw new Error(`Failed to create escalation: ${error.message}`);
    }

    return data as ArrearsEscalation;
  },

  /**
   * Mark an escalation as resolved (payment received or arrangement made).
   */
  async resolveEscalation(escalationId: string, notes?: string): Promise<ArrearsEscalation> {
    const { data, error } = await supabase
      .from('arrears_escalations')
      .update({
        stage: 'resolved',
        resolved_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq('id', escalationId)
      .select()
      .single();

    if (error) {
      console.error('Error resolving escalation:', error);
      throw new Error(`Failed to resolve escalation: ${error.message}`);
    }

    return data as ArrearsEscalation;
  },

  /**
   * Get all active escalations for an owner's properties.
   */
  async getOwnerEscalations(ownerId: string): Promise<EscalationSummary> {
    const { data, error } = await supabase
      .from('arrears_escalations')
      .select(`
        *,
        tenant:profiles!tenant_id(id, full_name, email, phone),
        property:properties!property_id(id, title, address)
      `)
      .eq('owner_id', ownerId)
      .neq('stage', 'resolved')
      .order('escalated_at', { ascending: false });

    if (error) {
      console.error('Error fetching owner escalations:', error);
      throw new Error(`Failed to fetch escalations: ${error.message}`);
    }

    const escalations = (data || []) as ArrearsEscalation[];
    const uniqueTenants = new Set(escalations.map((e) => e.tenant_id));

    // Determine highest stage
    const stageOrder: EscalationStage[] = [
      'friendly_reminder', 'formal_demand', 'breach_notice',
      'cure_period', 'legal_action', 'eviction_notice',
    ];
    let highestStage: EscalationStage | null = null;
    for (const e of escalations) {
      if (!highestStage || stageOrder.indexOf(e.stage) > stageOrder.indexOf(highestStage)) {
        highestStage = e.stage;
      }
    }

    return {
      escalations,
      totalOwed: escalations.reduce((sum, e) => sum + e.amount_owed, 0),
      totalInterest: escalations.reduce((sum, e) => sum + e.interest_accrued, 0),
      highestStage,
      tenantsInArrears: uniqueTenants.size,
    };
  },

  /**
   * Get escalation history for a specific tenant.
   */
  async getTenantEscalations(tenantId: string): Promise<ArrearsEscalation[]> {
    const { data, error } = await supabase
      .from('arrears_escalations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('escalated_at', { ascending: false });

    if (error) {
      console.error('Error fetching tenant escalations:', error);
      throw new Error(`Failed to fetch tenant escalations: ${error.message}`);
    }

    return data as ArrearsEscalation[];
  },

  /**
   * Advance breach notice to cure period stage.
   */
  async startCurePeriod(escalationId: string): Promise<ArrearsEscalation> {
    const cureStart = new Date();
    const cureEnd = calculateCurePeriodDeadline(cureStart);

    const { data, error } = await supabase
      .from('arrears_escalations')
      .update({
        stage: 'cure_period',
        cure_period_starts_at: cureStart.toISOString(),
        cure_period_ends_at: cureEnd.toISOString(),
      })
      .eq('id', escalationId)
      .select()
      .single();

    if (error) {
      console.error('Error starting cure period:', error);
      throw new Error(`Failed to start cure period: ${error.message}`);
    }

    return data as ArrearsEscalation;
  },

  /**
   * Escalate to legal action (post cure period expiry).
   */
  async escalateToLegalAction(escalationId: string, notes?: string): Promise<ArrearsEscalation> {
    const { data, error } = await supabase
      .from('arrears_escalations')
      .update({
        stage: 'legal_action',
        notes: notes || 'Cure period expired. Escalated to legal action.',
      })
      .eq('id', escalationId)
      .select()
      .single();

    if (error) {
      console.error('Error escalating to legal action:', error);
      throw new Error(`Failed to escalate: ${error.message}`);
    }

    return data as ArrearsEscalation;
  },
};
