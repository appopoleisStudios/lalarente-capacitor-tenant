/**
 * Invoices API
 * CRUD operations for maintenance invoices
 */

import { supabase } from '@/src/lib/supabase';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface MaintenanceInvoice {
  id: string;
  maintenance_request_id: string;
  vendor_id: string;
  owner_id: string;
  property_id: string;
  invoice_number: string;
  status: 'submitted' | 'approved' | 'rejected' | 'paid' | 'cancelled';
  line_items: InvoiceLineItem[];
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Generate an invoice number
 */
function generateInvoiceNumber(): string {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${date}-${random}`;
}

/**
 * Calculate totals from line items
 */
function calculateTotals(lineItems: InvoiceLineItem[]) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const vatAmount = subtotal * 0.15; // 15% VAT
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vat_amount: Math.round(vatAmount * 100) / 100,
    total_amount: Math.round((subtotal + vatAmount) * 100) / 100,
  };
}

/**
 * Submit an invoice for a completed maintenance job (Vendor action)
 */
export async function submitInvoice(
  maintenanceRequestId: string,
  vendorId: string,
  ownerId: string,
  propertyId: string,
  lineItems: InvoiceLineItem[],
  notes?: string
): Promise<MaintenanceInvoice> {
  if (lineItems.length === 0) {
    throw new Error('Please add at least one line item');
  }

  const totals = calculateTotals(lineItems);
  const invoiceNumber = generateInvoiceNumber();

  const { data, error } = await supabase
    .from('maintenance_invoices' as any)
    .insert({
      maintenance_request_id: maintenanceRequestId,
      vendor_id: vendorId,
      owner_id: ownerId,
      property_id: propertyId,
      invoice_number: invoiceNumber,
      status: 'submitted',
      line_items: lineItems,
      subtotal: totals.subtotal,
      vat_amount: totals.vat_amount,
      total_amount: totals.total_amount,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as MaintenanceInvoice;
}

/**
 * Get invoices for a maintenance request
 */
export async function getInvoicesByRequest(
  requestId: string
): Promise<MaintenanceInvoice[]> {
  const { data, error } = await supabase
    .from('maintenance_invoices' as any)
    .select('*')
    .eq('maintenance_request_id', requestId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as MaintenanceInvoice[];
}

/**
 * Approve an invoice (Owner action)
 */
export async function approveInvoice(
  invoiceId: string,
  ownerId: string
): Promise<MaintenanceInvoice> {
  const { data, error } = await supabase
    .from('maintenance_invoices' as any)
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: ownerId,
    })
    .eq('id', invoiceId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as MaintenanceInvoice;
}

/**
 * Reject an invoice (Owner action)
 */
export async function rejectInvoice(
  invoiceId: string,
  ownerId: string,
  reason: string
): Promise<MaintenanceInvoice> {
  if (!reason.trim()) {
    throw new Error('Please provide a reason for rejection');
  }

  const { data, error } = await supabase
    .from('maintenance_invoices' as any)
    .update({
      status: 'rejected',
      approved_at: new Date().toISOString(),
      approved_by: ownerId,
      rejection_reason: reason,
    })
    .eq('id', invoiceId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as MaintenanceInvoice;
}

/**
 * Get all invoices for an owner (for the owner invoices screen)
 */
export async function getInvoicesByOwner(
  ownerId: string
): Promise<MaintenanceInvoice[]> {
  const { data, error } = await supabase
    .from('maintenance_invoices' as any)
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as MaintenanceInvoice[];
}
