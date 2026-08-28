import {
  approvedInvoiceBannerCopy,
  authorizeVendorInvoicePayer,
  billedToLabel,
  ownerInvoiceFeaturePinMessage,
} from '../utils/vendorCheckoutAuth';

describe('authorizeVendorInvoicePayer', () => {
  const tenantId = 'tenant-1';
  const ownerId = 'owner-1';

  it('allows the job tenant when the invoice is billed to the tenant', () => {
    expect(
      authorizeVendorInvoicePayer({
        userId: tenantId,
        payerRole: 'tenant',
        ownerId,
        tenantId,
      })
    ).toEqual({ ok: true });
  });

  it('rejects a non-tenant for a tenant-billed invoice', () => {
    expect(
      authorizeVendorInvoicePayer({
        userId: ownerId,
        payerRole: 'tenant',
        ownerId,
        tenantId,
      })
    ).toEqual({ ok: false, error: 'Only the tenant for this job can pay.' });
  });

  it('allows the billed owner when the invoice is billed to the owner', () => {
    expect(
      authorizeVendorInvoicePayer({
        userId: ownerId,
        payerRole: 'owner',
        ownerId,
        tenantId,
      })
    ).toEqual({ ok: true });
  });

  it('rejects a non-owner for an owner-billed invoice', () => {
    expect(
      authorizeVendorInvoicePayer({
        userId: tenantId,
        payerRole: 'owner',
        ownerId,
        tenantId,
      })
    ).toEqual({ ok: false, error: 'Only the owner billed for this invoice can pay.' });
  });

  it('rejects an unknown payer role', () => {
    expect(
      authorizeVendorInvoicePayer({
        userId: ownerId,
        payerRole: 'vendor',
        ownerId,
        tenantId,
      })
    ).toEqual({ ok: false, error: 'This invoice has no valid payer.' });
  });
});

describe('approvedInvoiceBannerCopy', () => {
  it('tells the owner they can pay when billed to the owner', () => {
    expect(approvedInvoiceBannerCopy({ payerRole: 'owner', approvedAtLabel: '28 Aug 2026' })).toBe(
      'Approved 28 Aug 2026. You can pay this invoice now via PayFast.'
    );
  });

  it('tells the owner the tenant pays when billed to the tenant', () => {
    expect(approvedInvoiceBannerCopy({ payerRole: 'tenant', approvedAtLabel: '28 Aug 2026' })).toBe(
      'Approved 28 Aug 2026. The tenant can now pay this invoice in the app.'
    );
  });
});

describe('owner invoice copy helpers', () => {
  it('names who is billed', () => {
    expect(billedToLabel('owner')).toBe('Billed to you (owner)');
    expect(billedToLabel('tenant')).toBe('Billed to tenant');
  });

  it('does not claim the tenant always pays', () => {
    const message = ownerInvoiceFeaturePinMessage();
    expect(message).toMatch(/If you are billed/);
    expect(message).toMatch(/If the tenant is billed/);
    expect(message).not.toMatch(/Approve sends the invoice to your tenant to pay/);
  });
});
