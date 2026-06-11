/**
 * Tests for lease early termination penalty calculation.
 *
 * CPA s14: Early termination penalty capped at reasonable amount.
 * Common SA practice: max 2 months rent penalty.
 *
 * Reference implementation pattern: src/features/payments/__tests__/paymentGateway.test.ts
 */

// ─── Pure calculation helpers (mirrors logic in leaseTermination.api.ts) ─────

function calculateRemainingMonths(endDate: Date, today: Date): number {
  const diffMs = endDate.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)));
}

function calculatePenaltyAmount(remainingMonths: number, monthlyRent: number): number {
  const penaltyMonths = Math.min(2, remainingMonths);
  return penaltyMonths * monthlyRent;
}

function calculateEffectiveDate(today: Date, noticeDays: number): Date {
  const effective = new Date(today);
  effective.setDate(effective.getDate() + noticeDays);
  return effective;
}

function calculateNoticeDays(leaseNoticePeriod: number | null): number {
  return leaseNoticePeriod || 30;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Lease Termination Penalty', () => {
  describe('calculateRemainingMonths', () => {
    it('calculates remaining months for a lease ending in the future', () => {
      const today = new Date('2026-06-11T00:00:00Z');
      const endDate = new Date('2027-06-11T00:00:00Z');
      // 365 days / 30 ≈ 12.17, ceil = 13
      const remaining = calculateRemainingMonths(endDate, today);
      expect(remaining).toBe(13);
    });

    it('returns 0 for an already expired lease', () => {
      const today = new Date('2026-06-11T00:00:00Z');
      const endDate = new Date('2026-01-01T00:00:00Z');
      expect(calculateRemainingMonths(endDate, today)).toBe(0);
    });

    it('returns 0 for a lease ending today', () => {
      const today = new Date('2026-06-11T00:00:00Z');
      const endDate = new Date('2026-06-11T00:00:00Z');
      expect(calculateRemainingMonths(endDate, today)).toBe(0);
    });
  });

  describe('calculatePenaltyAmount', () => {
    it('caps penalty at 2 months rent for leases with >2 months remaining', () => {
      const penalty = calculatePenaltyAmount(10, 5000);
      expect(penalty).toBe(10000); // 2 × R5,000
    });

    it('calculates penalty for exactly 2 months remaining', () => {
      const penalty = calculatePenaltyAmount(2, 5000);
      expect(penalty).toBe(10000);
    });

    it('calculates penalty for less than 2 months remaining', () => {
      const penalty = calculatePenaltyAmount(1, 5000);
      expect(penalty).toBe(5000);
    });

    it('returns 0 penalty when no months remaining', () => {
      const penalty = calculatePenaltyAmount(0, 5000);
      expect(penalty).toBe(0);
    });

    it('handles high-value rental properties', () => {
      // R25,000/month property with 6 months remaining
      const penalty = calculatePenaltyAmount(6, 25000);
      expect(penalty).toBe(50000); // 2 × R25,000
    });
  });

  describe('calculateNoticeDays', () => {
    it('uses lease-specific notice period when set', () => {
      expect(calculateNoticeDays(30)).toBe(30);
      expect(calculateNoticeDays(60)).toBe(60);
    });

    it('defaults to 30 days when not specified', () => {
      expect(calculateNoticeDays(null)).toBe(30);
    });
  });

  describe('calculateEffectiveDate', () => {
    it('calculates effective date based on notice period', () => {
      const today = new Date('2026-06-11T00:00:00Z');
      const effective = calculateEffectiveDate(today, 30);
      expect(effective.toISOString().split('T')[0]).toBe('2026-07-11');
    });

    it('handles month boundaries', () => {
      const today = new Date('2026-06-01T00:00:00Z');
      const effective = calculateEffectiveDate(today, 30);
      expect(effective.toISOString().split('T')[0]).toBe('2026-07-01');
    });
  });
});
