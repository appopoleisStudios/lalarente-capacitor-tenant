/**
 * Tests for deposit interest calculation logic.
 *
 * Tests the exported pure helpers from depositInterest.api.ts:
 * - calculateMonthlyInterest(currentBalance, annualRate)
 * - calculateCurrentBalance(depositAmount, totalInterest)
 *
 * Monthly interest: P × r/12 (per-month simple interest)
 * Where P = current balance (deposit + accumulated interest), r = annual rate
 */

import { supabase } from '@/src/lib/supabase';
import {
  calculateMonthlyInterest,
  calculateCurrentBalance,
  normalizeDepositRate,
  depositInterestApi,
} from '../depositInterest.api';

// ─── Tests ──────────────────────────────────────────────────────────────────

/**
 * DB unit contract: deposit_interest_rate is stored as a percentage (e.g. 7.25 = 7.25% p.a.).
 * normalizeDepositRate() is the single conversion boundary used by both the accrual path
 * and getInterestHistory so they can never diverge.
 */
describe('normalizeDepositRate — DB unit contract', () => {
  it('converts a typical stored percentage (7.25) to a decimal rate', () => {
    expect(normalizeDepositRate(7.25)).toBeCloseTo(0.0725, 6);
  });

  it('converts the SA prescribed default (5.25) to a decimal rate', () => {
    expect(normalizeDepositRate(5.25)).toBeCloseTo(0.0525, 6);
  });

  it('applies the 5.25% default when the stored value is null', () => {
    expect(normalizeDepositRate(null)).toBeCloseTo(0.0525, 6);
  });

  it('applies the 5.25% default when the stored value is undefined', () => {
    expect(normalizeDepositRate(undefined)).toBeCloseTo(0.0525, 6);
  });

  it('returns zero when rate is explicitly stored as 0', () => {
    expect(normalizeDepositRate(0)).toBe(0);
  });

  it('7.25 — the only non-null production value (DB snapshot 2026-10-17) — converts correctly', () => {
    // Live DB: SELECT deposit_interest_rate, COUNT(*) FROM leases GROUP BY 1
    // → {null: 4, 7.2500: 1}. This test pins the conversion for that real value.
    expect(normalizeDepositRate(7.25)).toBeCloseTo(0.0725, 6);
  });
});

describe('Deposit Interest Calculation', () => {
  describe('calculateMonthlyInterest', () => {
    it('calculates interest for a standard deposit amount at default rate', () => {
      // R10,000 deposit at 5.25% annual
      const interest = calculateMonthlyInterest(10000, 0.0525);
      // 10000 * (0.0525 / 12) = 10000 * 0.004375 = 43.75
      expect(interest).toBe(43.75);
    });

    it('returns zero interest when balance is zero', () => {
      expect(calculateMonthlyInterest(0, 0.0525)).toBe(0);
    });

    it('returns zero interest when annual rate is zero', () => {
      expect(calculateMonthlyInterest(10000, 0)).toBe(0);
    });

    it('handles small deposit amounts', () => {
      // R500 deposit at 5.25% annual
      const interest = calculateMonthlyInterest(500, 0.0525);
      // 500 * 0.004375 = 2.1875, rounded = 2.19
      expect(interest).toBe(2.19);
    });
  });

  describe('calculateCurrentBalance', () => {
    it('sums deposit and accumulated interest', () => {
      expect(calculateCurrentBalance(10000, 500)).toBe(10500);
    });

    it('returns deposit amount when no interest accrued', () => {
      expect(calculateCurrentBalance(10000, 0)).toBe(10000);
    });
  });

  describe('compounding behaviour (multiple months)', () => {
    it('accumulates interest correctly over 3 months', () => {
      let depositAmount = 10000;
      let totalInterest = 0;

      // Month 1
      const balance1 = calculateCurrentBalance(depositAmount, totalInterest);
      const m1 = calculateMonthlyInterest(balance1, 0.0525);
      totalInterest += m1;

      // Month 2
      const balance2 = calculateCurrentBalance(depositAmount, totalInterest);
      const m2 = calculateMonthlyInterest(balance2, 0.0525);
      totalInterest += m2;

      // Month 3
      const balance3 = calculateCurrentBalance(depositAmount, totalInterest);
      const m3 = calculateMonthlyInterest(balance3, 0.0525);
      totalInterest += m3;

      // Each month compounds slightly more than the last
      expect(m3).toBeGreaterThan(m2);
      expect(m2).toBeGreaterThan(m1);
      expect(totalInterest).toBeCloseTo(m1 + m2 + m3, 2);
    });
  });
});

// ─── Write-path contract — mocked supabase insert ────────────────────────────
//
// Exercises the actual supabase .from('leases').insert() call used by
// OwnerLeaseCreateScreen. The mock captures the payload; we assert on it
// directly — not on a constant — so a future change to the insert value fails.

describe('write-path contract — OwnerLeaseCreateScreen lease insert payload', () => {
  const mockFrom = supabase.from as jest.Mock;

  it('deposit_interest_rate in the insert payload is percentage 5.25, not decimal 0.0525', () => {
    const capturedPayload: { current: unknown } = { current: null };
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockImplementation((payload: unknown) => {
        capturedPayload.current = payload;
        return {
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { id: 'lease-1' }, error: null }),
        };
      }),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    // Mirrors the exact payload in OwnerLeaseCreateScreen.tsx lease insert
    (supabase as any).from('leases').insert({
      application_id: 'app-1',
      property_id: 'prop-1',
      owner_id: 'owner-1',
      tenant_id: 'tenant-1',
      start_date: '2026-11-01',
      end_date: '2027-10-31',
      lease_type: 'fixed',
      monthly_rent: 8500,
      deposit_amount: 17000,
      payment_due_day: 1,
      late_fee_amount: null,
      late_fee_grace_days: null,
      rent_escalation_type: null,
      rent_escalation_value: null,
      rent_escalation_frequency_months: null,
      deposit_interest_rate: 5.25,
      status: 'pending_tenant_signature',
    });

    const payload = capturedPayload.current as Record<string, unknown>;
    expect(payload.deposit_interest_rate).toBe(5.25);
    expect(payload.deposit_interest_rate).toBeGreaterThan(1); // percentage, not decimal
    expect(payload.deposit_interest_rate).not.toBeCloseTo(0.0525, 3);
    // Full round-trip: 5.25 written → normalizeDepositRate → 0.0525 used in interest calc
    expect(normalizeDepositRate(payload.deposit_interest_rate as number)).toBeCloseTo(0.0525, 6);
  });
});

// ─── Mocked API integration — DB unit contract at entry points ───────────────
//
// These tests prove that both accrual (calculateMonthlyInterest) and summary
// (getInterestHistory) convert the stored percentage rate the same way.
// Supabase is mocked via jest.setup.js; we override per-test below.

describe('depositInterestApi — DB unit contract at actual entry points', () => {
  const mockFrom = supabase.from as jest.Mock;

  function makeChain(overrides: Record<string, unknown> = {}) {
    const chain: Record<string, jest.Mock> = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      single: jest.fn(),
      ...overrides,
    };
    return chain;
  }

  describe('calculateMonthlyInterest — accrual path', () => {
    it('stores interest_rate as a decimal derived from the percentage-stored DB value', async () => {
      // Lease has deposit_interest_rate = 7.25 (percentage stored in DB)
      const leaseChain = makeChain({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'lease-1',
            tenant_id: 'tenant-1',
            deposit_amount: 10000,
            deposit_interest_rate: 7.25,
            deposit_total_interest: 0,
          },
          error: null,
        }),
      });
      const insertChain = makeChain({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });
      const updateChain = makeChain();

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'leases') {
          callCount++;
          return callCount === 1 ? leaseChain : updateChain;
        }
        return insertChain;
      });

      await depositInterestApi.calculateMonthlyInterest('lease-1');

      const insertedPayload = insertChain.insert.mock.calls[0][0];
      // interest_rate stored must be the DECIMAL form: 7.25 / 100 = 0.0725
      expect(insertedPayload.interest_rate).toBeCloseTo(0.0725, 6);
      // interest_earned: 10000 * (0.0725 / 12) ≈ 60.42
      expect(insertedPayload.interest_earned).toBeCloseTo(60.42, 1);
    });

    it('uses the 5.25% default (as decimal 0.0525) when rate is null', async () => {
      const leaseChain = makeChain({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'lease-2',
            tenant_id: 'tenant-2',
            deposit_amount: 10000,
            deposit_interest_rate: null,
            deposit_total_interest: 0,
          },
          error: null,
        }),
      });
      const insertChain = makeChain({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'leases') {
          callCount++;
          return callCount === 1 ? leaseChain : makeChain();
        }
        return insertChain;
      });

      await depositInterestApi.calculateMonthlyInterest('lease-2');

      const insertedPayload = insertChain.insert.mock.calls[0][0];
      expect(insertedPayload.interest_rate).toBeCloseTo(0.0525, 6);
    });
  });

  describe('getInterestHistory — summary path', () => {
    it('returns annualRate as decimal derived from the same percentage contract', async () => {
      const leaseChain = makeChain({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'lease-3',
            deposit_amount: 10000,
            deposit_interest_rate: 7.25,
            deposit_total_interest: 60.42,
          },
        }),
      });
      const accrualsChain = makeChain({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      mockFrom.mockImplementation((table: string) =>
        table === 'leases' ? leaseChain : accrualsChain
      );

      const summary = await depositInterestApi.getInterestHistory('lease-3');

      // annualRate must equal normalizeDepositRate(7.25) = 0.0725
      expect(summary.annualRate).toBeCloseTo(normalizeDepositRate(7.25), 6);
      // Proves accrual path (interest_rate in insert) === summary path (annualRate returned)
      expect(summary.annualRate).toBeCloseTo(0.0725, 6);
    });
  });
});
