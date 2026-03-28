/**
 * Holding Deposit API
 *
 * Manages holding deposits that secure a property during application processing.
 * RHA s5A: Deposits must be refunded if application is rejected.
 */

import { supabase } from '../../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type HoldingDepositStatus = 'pending' | 'paid' | 'applied' | 'refunded' | 'forfeited' | 'expired';

export interface HoldingDeposit {
  id: string;
  property_id: string;
  tenant_id: string;
  application_id: string | null;
  amount: number;
  status: HoldingDepositStatus;
  payment_deadline: string | null;
  hold_expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateHoldingDepositInput {
  propertyId: string;
  applicationId?: string;
  amount: number;
  paymentDeadlineHours?: number; // Default 48 hours
  holdDurationDays?: number;     // Default 7 days
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const holdingDepositApi = {
  /**
   * Create a holding deposit request.
   */
  async createDeposit(tenantId: string, input: CreateHoldingDepositInput): Promise<HoldingDeposit> {
    const now = new Date();
    const paymentDeadline = new Date(now);
    paymentDeadline.setHours(paymentDeadline.getHours() + (input.paymentDeadlineHours || 48));

    const holdExpiry = new Date(now);
    holdExpiry.setDate(holdExpiry.getDate() + (input.holdDurationDays || 7));

    const { data, error } = await supabase
      .from('holding_deposits')
      .insert({
        property_id: input.propertyId,
        tenant_id: tenantId,
        application_id: input.applicationId || null,
        amount: input.amount,
        status: 'pending',
        payment_deadline: paymentDeadline.toISOString(),
        hold_expires_at: holdExpiry.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating holding deposit:', error);
      throw new Error(`Failed to create holding deposit: ${error.message}`);
    }

    return data as HoldingDeposit;
  },

  /**
   * Confirm payment of a holding deposit.
   */
  async confirmPayment(
    depositId: string,
    paymentMethod: string,
    transactionId?: string
  ): Promise<HoldingDeposit> {
    const { data, error } = await supabase
      .from('holding_deposits')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: paymentMethod,
        transaction_id: transactionId || null,
      })
      .eq('id', depositId)
      .select()
      .single();

    if (error) {
      console.error('Error confirming holding deposit:', error);
      throw new Error(`Failed to confirm deposit: ${error.message}`);
    }

    // Update property status to holding_deposit
    if (data.property_id) {
      await supabase
        .from('properties')
        .update({ status: 'holding_deposit' })
        .eq('id', data.property_id);
    }

    return data as HoldingDeposit;
  },

  /**
   * Apply holding deposit to first month's rent/security deposit.
   */
  async applyToLease(depositId: string): Promise<HoldingDeposit> {
    const { data, error } = await supabase
      .from('holding_deposits')
      .update({
        status: 'applied',
        applied_at: new Date().toISOString(),
      })
      .eq('id', depositId)
      .select()
      .single();

    if (error) {
      console.error('Error applying holding deposit:', error);
      throw new Error(`Failed to apply deposit: ${error.message}`);
    }

    return data as HoldingDeposit;
  },

  /**
   * Refund a holding deposit (application rejected).
   * RHA s5A: Must be refunded if application is unsuccessful.
   */
  async refundDeposit(depositId: string, reason: string): Promise<HoldingDeposit> {
    const { data, error } = await supabase
      .from('holding_deposits')
      .update({
        status: 'refunded',
        refunded_at: new Date().toISOString(),
        refund_reason: reason,
      })
      .eq('id', depositId)
      .select()
      .single();

    if (error) {
      console.error('Error refunding holding deposit:', error);
      throw new Error(`Failed to refund deposit: ${error.message}`);
    }

    return data as HoldingDeposit;
  },

  /**
   * Get holding deposits for a tenant.
   */
  async getTenantDeposits(tenantId: string): Promise<HoldingDeposit[]> {
    const { data, error } = await supabase
      .from('holding_deposits')
      .select(`
        *,
        property:properties!property_id(id, title, address)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tenant deposits:', error);
      throw new Error(`Failed to fetch deposits: ${error.message}`);
    }

    return data as HoldingDeposit[];
  },

  /**
   * Get holding deposits for a property (owner view).
   */
  async getPropertyDeposits(propertyId: string): Promise<HoldingDeposit[]> {
    const { data, error } = await supabase
      .from('holding_deposits')
      .select(`
        *,
        tenant:profiles!tenant_id(id, full_name, email, phone)
      `)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching property deposits:', error);
      throw new Error(`Failed to fetch deposits: ${error.message}`);
    }

    return data as HoldingDeposit[];
  },
};
