export type VendorInvoicePayerRole = 'owner' | 'tenant';

export function authorizeVendorInvoicePayer(params: {
  userId: string;
  payerRole: string | null | undefined;
  ownerId: string | null | undefined;
  tenantId: string | null | undefined;
}): { ok: true } | { ok: false; error: string } {
  if (params.payerRole === 'tenant') {
    if (!params.tenantId || params.tenantId !== params.userId) {
      return { ok: false, error: 'Only the tenant for this job can pay.' };
    }
    return { ok: true };
  }

  if (params.payerRole === 'owner') {
    if (!params.ownerId || params.ownerId !== params.userId) {
      return { ok: false, error: 'Only the owner billed for this invoice can pay.' };
    }
    return { ok: true };
  }

  return { ok: false, error: 'This invoice has no valid payer.' };
}

export function approvedInvoiceBannerCopy(opts: {
  payerRole: string | null | undefined;
  approvedAtLabel: string;
}): string {
  if (opts.payerRole === 'owner') {
    return `Approved ${opts.approvedAtLabel}. You can pay this invoice now via PayFast.`;
  }
  return `Approved ${opts.approvedAtLabel}. The tenant can now pay this invoice in the app.`;
}

export function ownerInvoiceFeaturePinMessage(): string {
  return 'Approve confirms the invoice. If you are billed, pay via PayFast on this screen. If the tenant is billed, they pay in the app. Reject asks the vendor to fix it — add a reason so they know what to change.';
}

export function billedToLabel(payerRole: string | null | undefined): string {
  return payerRole === 'owner' ? 'Billed to you (owner)' : 'Billed to tenant';
}
