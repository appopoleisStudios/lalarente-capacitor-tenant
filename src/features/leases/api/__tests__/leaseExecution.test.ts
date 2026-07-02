/**
 * Tests for lease execution logic.
 *
 * Tests the exported pure helper from leaseExecutionService.ts:
 * - canExecuteLease(lease) — checks if both parties have signed
 *
 * Lease execution requires:
 * - owner_signed_at: not null
 * - tenant_signed_at: not null
 * - status: not 'active' (prevents double execution)
 */

import { canExecuteLease } from '../leaseExecutionService';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('canExecuteLease', () => {
  it('returns true when both parties have signed and lease is not active', () => {
    const lease = {
      owner_signed_at: '2026-06-11T10:00:00Z',
      tenant_signed_at: '2026-06-11T12:00:00Z',
      status: 'pending_signatures',
    };
    expect(canExecuteLease(lease)).toBe(true);
  });

  it('returns false when owner has not signed', () => {
    const lease = {
      owner_signed_at: null,
      tenant_signed_at: '2026-06-11T12:00:00Z',
      status: 'pending_signatures',
    };
    expect(canExecuteLease(lease)).toBe(false);
  });

  it('returns false when tenant has not signed', () => {
    const lease = {
      owner_signed_at: '2026-06-11T10:00:00Z',
      tenant_signed_at: null,
      status: 'pending_signatures',
    };
    expect(canExecuteLease(lease)).toBe(false);
  });

  it('returns false when neither party has signed', () => {
    const lease = {
      owner_signed_at: null,
      tenant_signed_at: null,
      status: 'pending_signatures',
    };
    expect(canExecuteLease(lease)).toBe(false);
  });

  it('returns false when lease is already active (prevents double execution)', () => {
    const lease = {
      owner_signed_at: '2026-06-11T10:00:00Z',
      tenant_signed_at: '2026-06-11T12:00:00Z',
      status: 'active',
    };
    expect(canExecuteLease(lease)).toBe(false);
  });

});
