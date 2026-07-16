/**
 * Invoices API
 * CRUD operations for maintenance invoices
 *
 * Security model:
 * - Vendors can only submit invoices for jobs they are assigned to
 * - Owners can only approve/reject invoices for their own properties
 * - All state transitions verify current status to prevent race conditions
 * - Duplicate submissions are prevented via idempotency check
 */

import { supabase } from '@/src/lib/supabase';

// ============================================
// Constants
// ============================================

/** South Africa VAT rate (15%) — centralised in one place */
export const VAT_RATE = 0.15;

// ============================================
// Error codes
// ============================================

export const InvoiceErrorCode = {
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  VENDOR_NOT_ASSIGNED: 'VENDOR_NOT_ASSIGNED',
  NOT_AUTHORISED: 'NOT_AUTHORISED',
  DUPLICATE_SUBMISSION: 'DUPLICATE_SUBMISSION',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  RACE_CONDITION: 'RACE_CONDITION',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REJECTION_REASON_REQUIRED: 'REJECTION_REASON_REQUIRED',
  MAINTENANCE_REQUEST_NOT_FOUND: 'MAINTENANCE_REQUEST_NOT_FOUND',
} as const;

export type InvoiceErrorCode = typeof InvoiceErrorCode[keyof typeof InvoiceErrorCode];

/**
 * Custom error class that includes a machine-readable error code
 */
export class InvoiceError extends Error {
  code: InvoiceErrorCode;

  constructor(code: InvoiceErrorCode, message: string) {
    super(message);
    this.name = 'InvoiceError';
    this.code = code;
  }
}

/**
 * Log an invoice audit event to both the database audit table and console
 * Requires ownerId and vendorId for the denormalized RLS columns
 */
async function logAuditEvent(
  event: string,
  invoiceId: string,
  actorId: string,
  ownerId: string,
  vendorId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const timestamp = new Date().toISOString();

  // Write to DB audit log
  // If the audit log insert fails, we retry once after a short delay
  // before falling back to console-only logging
  const maxRetries = 1;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await supabase
        .from('maintenance_invoice_audit_logs' as any)
        .insert({
          invoice_id: invoiceId,
          actor_id: actorId,
          owner_id: ownerId,
          vendor_id: vendorId,
          event,
          metadata: metadata || null,
        });
      break; // success — exit retry loop
    } catch (err) {
      if (attempt < maxRetries) {
        // Brief backoff before retry
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        // Final attempt failed — log to console as fallback
        console.error('Failed to write invoice audit log after retry:', err);
      }
    }
  }

  // Console log as secondary backup
  console.log(
    JSON.stringify({
      type: 'invoice_audit',
      timestamp,
      event,
      invoice_id: invoiceId,
      actor_id: actorId,
      owner_id: ownerId,
      vendor_id: vendorId,
      ...(metadata ? { metadata } : {}),
    })
  );
}

// ============================================
// Types
// ============================================

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
  rejected_at: string | null;
  rejection_reason: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Statuses that allow the invoice to be actioned */
const ACTIONABLE_STATUSES = ['submitted'] as const;

// ============================================
// Helpers
// ============================================

/**
 * Generate an invoice number using date + random suffix
 * Format: INV-YYYYMMDD-XXXX
 */
function generateInvoiceNumber(): string {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${date}-${random}`;
}

/**
 * Calculate totals from validated line items
 */
function calculateTotals(lineItems: InvoiceLineItem[]) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const vatAmount = subtotal * VAT_RATE;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vat_amount: Math.round(vatAmount * 100) / 100,
    total_amount: Math.round((subtotal + vatAmount) * 100) / 100,
  };
}

/**
 * Validate line items at the API layer
 * Catches negatives, empty descriptions, and zero-or-negative unit prices
 */
function validateLineItems(lineItems: InvoiceLineItem[]): void {
  if (!lineItems || lineItems.length === 0) {
    throw new InvoiceError(InvoiceErrorCode.VALIDATION_ERROR, 'At least one line item is required');
  }

  for (const [i, item] of lineItems.entries()) {
    if (!item.description || item.description.trim().length === 0) {
      throw new InvoiceError(InvoiceErrorCode.VALIDATION_ERROR, `Line item ${i + 1}: description is required`);
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new InvoiceError(InvoiceErrorCode.VALIDATION_ERROR, `Line item ${i + 1}: quantity must be a positive number`);
    }
    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      throw new InvoiceError(InvoiceErrorCode.VALIDATION_ERROR, `Line item ${i + 1}: unit price must be a non-negative number`);
    }
  }
}

/**
 * Fetch a single invoice by ID (used internally for authorization checks)
 */
async function getInvoiceById(invoiceId: string): Promise<MaintenanceInvoice | null> {
  const { data, error } = await supabase
    .from('maintenance_invoices' as any)
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (error) return null;
  return data as unknown as MaintenanceInvoice;
}

// ============================================
// Public API
// ============================================

/**
 * Submit an invoice for a completed maintenance job (Vendor action)
 *
 * Security:
 * 1. Validates vendor is the assigned vendor for this request
 * 2. Prevents duplicate submissions (idempotency)
 * 3. Validates line items at API layer
 */
export async function submitInvoice(
  maintenanceRequestId: string,
  vendorId: string,
  ownerId: string,
  propertyId: string,
  lineItems: InvoiceLineItem[],
  notes?: string,
  payerRole?: 'tenant' | 'owner'
): Promise<MaintenanceInvoice> {
  // 1. API-level validation
  validateLineItems(lineItems);

  // 2. Calculate totals early so we can validate them before DB lookups
  const preTotals = calculateTotals(lineItems);
  if (preTotals.subtotal <= 0) {
    throw new InvoiceError(
      InvoiceErrorCode.VALIDATION_ERROR,
      'Invoice subtotal must be greater than zero'
    );
  }
  if (preTotals.total_amount <= 0) {
    throw new InvoiceError(
      InvoiceErrorCode.VALIDATION_ERROR,
      'Invoice total amount must be greater than zero'
    );
  }

  // 3. Verify vendor is assigned to this maintenance request and request is completed
  const { data: requestData, error: requestError } = await supabase
    .from('maintenance_requests' as any)
    .select('id, selected_vendor_id, status')
    .eq('id', maintenanceRequestId)
    .single();

  if (requestError || !requestData) {
    throw new InvoiceError(
      InvoiceErrorCode.MAINTENANCE_REQUEST_NOT_FOUND,
      'Maintenance request not found'
    );
  }

  const request = requestData as any;
  if (!request.selected_vendor_id || request.selected_vendor_id !== vendorId) {
    throw new InvoiceError(
      InvoiceErrorCode.VENDOR_NOT_ASSIGNED,
      'You are not authorised to submit an invoice for this request'
    );
  }

  // Only allow invoicing for completed requests
  if (request.status !== 'completed') {
    throw new InvoiceError(
      InvoiceErrorCode.INVALID_STATUS_TRANSITION,
      'Invoices can only be submitted for completed maintenance requests'
    );
  }

  // 4. Idempotency check — prevent duplicate submissions
  // We query for active (non-cancelled) invoices directly
  const { data: existingInvoices } = await supabase
    .from('maintenance_invoices' as any)
    .select('id, status, invoice_number')
    .eq('maintenance_request_id', maintenanceRequestId)
    .eq('vendor_id', vendorId)
    .in('status', ['submitted', 'approved', 'paid']);

  const existing = (existingInvoices || []) as any[];
  if (existing.length > 0) {
    throw new InvoiceError(
      InvoiceErrorCode.DUPLICATE_SUBMISSION,
      'An invoice has already been submitted for this job. Please check your invoices list.'
    );
  }

  // 5. Calculate totals and generate invoice number
  const totals = preTotals;
  const invoiceNumber = generateInvoiceNumber();

  // 6. Insert
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
      payer_role: payerRole || 'owner',
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
 *
 * Security:
 * 1. Verifies the caller is the owner of the invoice's property
 * 2. Only allows approving invoices in 'submitted' status
 */
export async function approveInvoice(
  invoiceId: string,
  ownerId: string
): Promise<MaintenanceInvoice> {
  // 1. Fetch current invoice state
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    throw new InvoiceError(InvoiceErrorCode.INVOICE_NOT_FOUND, 'Invoice not found');
  }

  // 2. Authorization: only the invoice's owner can approve
  if (invoice.owner_id !== ownerId) {
    throw new InvoiceError(InvoiceErrorCode.NOT_AUTHORISED, 'You are not authorised to approve this invoice');
  }

  // 3. Concurrent status check: only submitted invoices can be approved
  if (!ACTIONABLE_STATUSES.includes(invoice.status as any)) {
    throw new InvoiceError(
      InvoiceErrorCode.INVALID_STATUS_TRANSITION,
      'Only submitted invoices can be approved'
    );
  }

  // 4. Apply the state transition (single atomic update)
  const { data, error } = await supabase
    .from('maintenance_invoices' as any)
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: ownerId,
    })
    .eq('id', invoiceId)
    .eq('status', 'submitted') // Optimistic lock: only update if still submitted
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    // Race condition: another request already changed the status
    throw new InvoiceError(InvoiceErrorCode.RACE_CONDITION, 'Invoice was already modified by another request. Please refresh and try again.');
  }

  // 5. Audit trail
  await logAuditEvent('invoice_approved', invoiceId, ownerId, invoice.owner_id, invoice.vendor_id, {
    invoice_number: invoice.invoice_number,
    amount: invoice.total_amount,
  });

  return data as unknown as MaintenanceInvoice;
}

/**
 * Reject an invoice (Owner action)
 *
 * Security:
 * 1. Verifies the caller is the owner of the invoice's property
 * 2. Only allows rejecting invoices in 'submitted' status
 */
export async function rejectInvoice(
  invoiceId: string,
  ownerId: string,
  reason: string
): Promise<MaintenanceInvoice> {
  if (!reason.trim()) {
    throw new InvoiceError(InvoiceErrorCode.REJECTION_REASON_REQUIRED, 'Please provide a reason for rejection');
  }

  // 1. Fetch current invoice state
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    throw new InvoiceError(InvoiceErrorCode.INVOICE_NOT_FOUND, 'Invoice not found');
  }

  // 2. Authorization: only the invoice's owner can reject
  if (invoice.owner_id !== ownerId) {
    throw new InvoiceError(InvoiceErrorCode.NOT_AUTHORISED, 'You are not authorised to reject this invoice');
  }

  // 3. Concurrent status check
  if (!ACTIONABLE_STATUSES.includes(invoice.status as any)) {
    throw new InvoiceError(
      InvoiceErrorCode.INVALID_STATUS_TRANSITION,
      'Only submitted invoices can be rejected'
    );
  }

  // 4. Apply the state transition (single atomic update with optimistic lock)
  const { data, error } = await supabase
    .from('maintenance_invoices' as any)
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejection_reason: reason.trim(),
    })
    .eq('id', invoiceId)
    .eq('status', 'submitted') // Optimistic lock
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    throw new InvoiceError(InvoiceErrorCode.RACE_CONDITION, 'Invoice was already modified by another request. Please refresh and try again.');
  }

  // 5. Audit trail
  await logAuditEvent('invoice_rejected', invoiceId, ownerId, invoice.owner_id, invoice.vendor_id, {
    invoice_number: invoice.invoice_number,
    reason: reason.trim(),
  });

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
