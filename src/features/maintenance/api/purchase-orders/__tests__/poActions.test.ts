/**
 * Tests for Purchase Order Actions API
 * Covers acceptPO, rejectPO, updatePOStatus, and the verifyVendorAssignment security check
 */

import { supabase } from '@/lib/supabase';
import { acceptPO, rejectPO, updatePOStatus } from '../poActions.api';
import type { PurchaseOrder } from '../../types/po.types';

// ── Test data ──────────────────────────────────────────────────────

const mockPO: PurchaseOrder = {
  id: 'po-1',
  contract_id: 'contract-1',
  po_number: 'PO-001',
  currency: 'ZAR',
  subtotal: 1000,
  vat_amount: 150,
  platform_fee_amount: 50,
  total_amount: 1200,
  status: 'issued',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockContract = { id: 'contract-1', vendor_id: 'vendor-123' };

// ── Helpers ────────────────────────────────────────────────────────

interface MockChain {
  [key: string]: jest.Mock;
}

function fluentChain(overrides: Record<string, jest.Mock | undefined> = {}): MockChain {
  const chain: MockChain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  return Object.assign(chain, overrides);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── updatePOStatus ─────────────────────────────────────────────────

describe('updatePOStatus', () => {
  it('updates a PO status and returns the updated record', async () => {
    const updatedPO = { ...mockPO, status: 'accepted' as const };
    const chain = fluentChain({
      single: jest.fn().mockResolvedValue({ data: updatedPO, error: null }),
    });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await updatePOStatus('po-1', 'accepted');

    expect(supabase.from).toHaveBeenCalledWith('purchase_orders');
    expect(result).toEqual(updatedPO);
  });

  it('throws when the database update fails', async () => {
    const chain = fluentChain({
      single: jest.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
    });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(updatePOStatus('po-1', 'rejected')).rejects.toThrow('DB error');
  });
});

// ── acceptPO ───────────────────────────────────────────────────────

describe('acceptPO', () => {
  it('accepts a PO when the vendor is assigned to the contract', async () => {
    // Call 1: verifyVendorAssignment fetches PO
    const c1 = fluentChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: { contract_id: 'contract-1' }, error: null }),
    });
    // Call 2: verifyVendorAssignment fetches contract
    const c2 = fluentChain({
      single: jest.fn().mockResolvedValue({ data: mockContract, error: null }),
    });
    // Call 3: updatePOStatus
    const c3 = fluentChain({
      single: jest.fn().mockResolvedValue({ data: { ...mockPO, status: 'accepted' }, error: null }),
    });

    (supabase.from as jest.Mock)
      .mockReturnValueOnce(c1)
      .mockReturnValueOnce(c2)
      .mockReturnValueOnce(c3);

    const result = await acceptPO('po-1', 'vendor-123');

    expect(supabase.from).toHaveBeenNthCalledWith(1, 'purchase_orders');
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'service_contracts');
    expect(supabase.from).toHaveBeenNthCalledWith(3, 'purchase_orders');
    expect(result.status).toBe('accepted');
  });

  it('throws when a different vendor tries to accept', async () => {
    const c1 = fluentChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: { contract_id: 'contract-1' }, error: null }),
    });
    const c2 = fluentChain({
      single: jest.fn().mockResolvedValue({ data: mockContract, error: null }),
    });

    (supabase.from as jest.Mock)
      .mockReturnValueOnce(c1)
      .mockReturnValueOnce(c2);

    await expect(acceptPO('po-1', 'wrong-vendor')).rejects.toThrow('not authorized');
  });
});

// ── rejectPO ───────────────────────────────────────────────────────

describe('rejectPO', () => {
  it('persists the rejection reason and updates status to rejected', async () => {
    // Call 1: verifyVendorAssignment fetches PO
    const c1 = fluentChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: { contract_id: 'contract-1' }, error: null }),
    });
    // Call 2: verifyVendorAssignment fetches contract
    const c2 = fluentChain({
      single: jest.fn().mockResolvedValue({ data: mockContract, error: null }),
    });
    // Call 3: persist rejection reason (update() → eq() returns Promise)
    const reasonEq = jest.fn().mockResolvedValue({ error: null });
    const c3 = fluentChain({ update: jest.fn().mockReturnValue({ eq: reasonEq }) });
    // Call 4: updatePOStatus
    const c4 = fluentChain({
      single: jest.fn().mockResolvedValue({ data: { ...mockPO, status: 'rejected' }, error: null }),
    });

    (supabase.from as jest.Mock)
      .mockReturnValueOnce(c1)
      .mockReturnValueOnce(c2)
      .mockReturnValueOnce(c3)
      .mockReturnValueOnce(c4);

    const result = await rejectPO('po-1', 'vendor-123', 'Not available');

    expect(reasonEq).toHaveBeenCalledWith('id', 'po-1');
    expect(c4.single).toHaveBeenCalled();
    expect(result.status).toBe('rejected');
  });

  it('throws if the rejection reason cannot be persisted (status unchanged)', async () => {
    // Call 1: verifyVendorAssignment fetches PO
    const c1 = fluentChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: { contract_id: 'contract-1' }, error: null }),
    });
    // Call 2: verifyVendorAssignment fetches contract
    const c2 = fluentChain({
      single: jest.fn().mockResolvedValue({ data: mockContract, error: null }),
    });
    // Call 3: persist rejection reason — FAILS
    const reasonEq = jest.fn().mockResolvedValue({ error: new Error('DB write failed') });
    const c3 = fluentChain({ update: jest.fn().mockReturnValue({ eq: reasonEq }) });
    // Call 4: should NOT be reached
    const c4 = fluentChain({
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    });

    (supabase.from as jest.Mock)
      .mockReturnValueOnce(c1)
      .mockReturnValueOnce(c2)
      .mockReturnValueOnce(c3)
      .mockReturnValueOnce(c4);

    await expect(rejectPO('po-1', 'vendor-123', 'Reason')).rejects.toThrow(
      'Failed to record rejection reason'
    );

    // PO status should NOT have been updated
    expect(c4.single).not.toHaveBeenCalled();
  });
});
