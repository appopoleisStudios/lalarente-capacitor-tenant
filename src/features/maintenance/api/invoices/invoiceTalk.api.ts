/**
 * Plane #110 — pre-pay invoice talk + escalate (not rent / PayFast disputes)
 */

import { supabase } from '@/src/lib/supabase';
import { InvoiceError, InvoiceErrorCode, type MaintenanceInvoice } from './invoices.api';

export type InvoiceTalkState = {
  confirmations: { user_id: string; created_at: string }[];
  confirmedByMe: boolean;
  bothConfirmed: boolean;
};

async function logTalkEvent(
  event: string,
  invoice: MaintenanceInvoice,
  actorId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('maintenance_invoice_audit_logs' as any).insert({
      invoice_id: invoice.id,
      actor_id: actorId,
      owner_id: invoice.owner_id,
      vendor_id: invoice.vendor_id,
      event,
      metadata: metadata || null,
    });
  } catch (err) {
    console.error('Failed to write invoice talk audit log:', err);
  }
}

export async function getInvoiceTalkState(
  invoice: Pick<MaintenanceInvoice, 'id' | 'vendor_id' | 'owner_id' | 'payer_role'>,
  userId: string,
  tenantId?: string | null
): Promise<InvoiceTalkState> {
  const { data, error } = await supabase
    .from('invoice_talk_confirmations' as any)
    .select('user_id, created_at')
    .eq('invoice_id', invoice.id);

  if (error) throw error;
  const confirmations = (data || []) as unknown as { user_id: string; created_at: string }[];
  const payerId = invoice.payer_role === 'tenant' ? tenantId : invoice.owner_id;
  const ids = new Set(confirmations.map((row) => row.user_id));
  return {
    confirmations,
    confirmedByMe: ids.has(userId),
    bothConfirmed: Boolean(payerId && ids.has(invoice.vendor_id) && ids.has(payerId)),
  };
}

export async function confirmInvoiceTalk(invoiceId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('invoice_talk_confirmations' as any).insert({
    invoice_id: invoiceId,
    user_id: userId,
  });
  if (
    error &&
    error.code !== '23505' &&
    !String(error.message).toLowerCase().includes('duplicate')
  ) {
    throw new InvoiceError(InvoiceErrorCode.VALIDATION_ERROR, error.message);
  }
}

export async function escalateInvoiceToLalaRente(invoiceId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('escalate_maintenance_invoice', {
    p_invoice_id: invoiceId,
  });
  if (error) {
    throw new InvoiceError(InvoiceErrorCode.VALIDATION_ERROR, error.message);
  }
}

export async function listDisputedInvoices(): Promise<MaintenanceInvoice[]> {
  const { data, error } = await supabase
    .from('maintenance_invoices' as any)
    .select('*')
    .eq('status', 'disputed')
    .order('escalated_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as MaintenanceInvoice[];
}

export async function resolveInvoiceDispute(
  invoiceId: string,
  decision: 'uphold_vendor' | 'amend_amount' | 'reject',
  notes: string,
  amendedAmount?: number
): Promise<void> {
  const { error } = await (supabase as any).rpc('resolve_maintenance_invoice_dispute', {
    p_invoice_id: invoiceId,
    p_decision: decision,
    p_notes: notes,
    p_amended_amount: amendedAmount ?? null,
  });
  if (error) {
    throw new InvoiceError(InvoiceErrorCode.VALIDATION_ERROR, error.message);
  }
}

export async function getInvoiceAuditLog(
  invoiceId: string
): Promise<{ event: string; created_at: string; metadata: unknown }[]> {
  const { data, error } = await supabase
    .from('maintenance_invoice_audit_logs' as any)
    .select('event, created_at, metadata')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as { event: string; created_at: string; metadata: unknown }[];
}

export { logTalkEvent };
