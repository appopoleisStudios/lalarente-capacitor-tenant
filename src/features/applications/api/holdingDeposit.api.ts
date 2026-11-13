/**
 * Holding Deposit API
 *
 * Manages holding deposits that secure a property during application processing.
 * RHA s5A: Deposits must be refunded if application is rejected.
 */

import { supabase } from '../../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type HoldingDepositStatus =
  | 'pending'
  | 'paid'
  | 'applied'
  | 'refunded'
  | 'forfeited'
  | 'expired';

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
  // Set when the tenant reports having paid. The deposit stays 'pending'
  // until the owner confirms receipt (see isPaymentClaimed).
  payment_method?: string | null;
  created_at: string;
  updated_at: string;
  // CT7-018 — bank-statement reference the tenant uses when paying by
  // EFT. Generated server-side by trg_holding_deposit_reference; the
  // client reads it, displays it, and lets the tenant copy it.
  // Optional on the TS interface so queries written before the column
  // existed keep typing; the column itself is NOT NULL at the DB layer
  // and always populated by the trigger.
  reference?: string;
}

export interface CreateHoldingDepositInput {
  propertyId: string;
  applicationId?: string;
  amount: number;
  paymentDeadlineHours?: number; // Default 48 hours
  holdDurationDays?: number; // Default 7 days
}

/**
 * True when the tenant has reported payment and the owner has not yet
 * confirmed receipt. Only an owner confirmation moves a deposit to 'paid'.
 */
export const isPaymentClaimed = (deposit: {
  status: string;
  payment_method?: string | null;
}): boolean => deposit.status === 'pending' && !!deposit.payment_method;

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
   * Tenant reports that they have paid. Does NOT mark the deposit paid or
   * hold the property — the owner must confirm receipt first.
   */
  async claimPayment(depositId: string, paymentMethod: string): Promise<HoldingDeposit> {
    // RPC: tenants have no UPDATE on holding_deposits; the function only sets
    // payment_method on the caller's own pending deposit.
    const { data, error } = await (supabase as any)
      .rpc('claim_holding_deposit_payment', {
        p_deposit_id: depositId,
        p_payment_method: paymentMethod,
      })
      .single();

    if (error) {
      console.error('Error reporting holding deposit payment:', error);
      throw new Error(`Failed to report payment: ${error.message}`);
    }

    return data as HoldingDeposit;
  },

  /**
   * Owner did not receive the payment the tenant reported. Clears the claim
   * so the tenant can pay and report again.
   */
  async rejectPaymentClaim(depositId: string): Promise<HoldingDeposit> {
    const { data, error } = await supabase
      .from('holding_deposits')
      .update({ payment_method: null })
      .eq('id', depositId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      console.error('Error rejecting holding deposit payment claim:', error);
      throw new Error(`Failed to update deposit: ${error.message}`);
    }

    return data as HoldingDeposit;
  },

  /**
   * Owner confirms receipt of a holding deposit. Marks it paid and holds
   * the property.
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
      .select(
        `
        *,
        property:properties!property_id(id, title, address)
      `
      )
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
      .select(
        `
        *,
        tenant:profiles!tenant_id(id, full_name, email, phone)
      `
      )
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching property deposits:', error);
      throw new Error(`Failed to fetch deposits: ${error.message}`);
    }

    return data as HoldingDeposit[];
  },
};
