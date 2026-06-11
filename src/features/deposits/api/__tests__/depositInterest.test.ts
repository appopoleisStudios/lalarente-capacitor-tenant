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

import {
  calculateMonthlyInterest,
  calculateCurrentBalance,
} from '../depositInterest.api';

// ─── Tests ──────────────────────────────────────────────────────────────────

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
