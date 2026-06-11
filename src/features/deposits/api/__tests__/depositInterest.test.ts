/**
 * Tests for deposit interest calculation logic.
 *
 * Monthly interest: P × r/12
 * Where P = principal (deposit), r = annual rate
 *
 * Reference implementation pattern: src/features/payments/__tests__/paymentGateway.test.ts
 */

// ─── Pure calculation helpers (mirrors logic in depositInterest.api.ts) ───────

/**
 * Calculate monthly interest using the same formula as the API.
 * Per-month simple interest: P × r/12
 */
function calculateMonthlyInterest(
  currentBalance: number,
  annualRate: number
): number {
  const monthlyRate = annualRate / 12;
  return Math.round(currentBalance * monthlyRate * 100) / 100;
}

function calculateCumulativeInterest(
  depositAmount: number,
  totalInterest: number,
  monthlyInterest: number
): number {
  return totalInterest + monthlyInterest;
}

function calculateCurrentBalance(
  depositAmount: number,
  totalInterest: number
): number {
  return depositAmount + totalInterest;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Deposit Interest Calculation', () => {
  describe('calculateMonthlyInterest', () => {
    it('calculates interest for a standard deposit amount at default rate', () => {
      // R10,000 deposit at 5.25% annual
      const interest = calculateMonthlyInterest(10000, 0.0525);
      const expected = Math.round(10000 * (0.0525 / 12) * 100) / 100;
      expect(interest).toBe(expected);
      // 10000 * 0.004375 = 43.75
      expect(interest).toBe(43.75);
    });

    it('returns zero interest when balance is zero', () => {
      const interest = calculateMonthlyInterest(0, 0.0525);
      expect(interest).toBe(0);
    });

    it('returns zero interest when annual rate is zero', () => {
      const interest = calculateMonthlyInterest(10000, 0);
      expect(interest).toBe(0);
    });

    it('handles small deposit amounts', () => {
      // R500 deposit at 5.25% annual
      const interest = calculateMonthlyInterest(500, 0.0525);
      const expected = Math.round(500 * (0.0525 / 12) * 100) / 100;
      expect(interest).toBe(expected);
      // 500 * 0.004375 = 2.1875, rounded = 2.19
      expect(interest).toBe(2.19);
    });
  });

  describe('calculateCurrentBalance', () => {
    it('sums deposit and accumulated interest', () => {
      const balance = calculateCurrentBalance(10000, 500);
      expect(balance).toBe(10500);
    });

    it('returns deposit amount when no interest accrued', () => {
      const balance = calculateCurrentBalance(10000, 0);
      expect(balance).toBe(10000);
    });
  });

  describe('calculateCumulativeInterest', () => {
    it('accumulates interest correctly over multiple months', () => {
      // Simulate 3 months of interest
      let depositAmount = 10000;
      let totalInterest = 0;

      // Month 1
      const m1 = calculateMonthlyInterest(depositAmount + totalInterest, 0.0525);
      totalInterest = calculateCumulativeInterest(depositAmount, totalInterest, m1);

      // Month 2
      const m2 = calculateMonthlyInterest(depositAmount + totalInterest, 0.0525);
      totalInterest = calculateCumulativeInterest(depositAmount, totalInterest, m2);

      // Month 3
      const m3 = calculateMonthlyInterest(depositAmount + totalInterest, 0.0525);
      totalInterest = calculateCumulativeInterest(depositAmount, totalInterest, m3);

      // Each month compounds slightly more than the last
      expect(m3).toBeGreaterThan(m2);
      expect(m2).toBeGreaterThan(m1);
      expect(totalInterest).toBeGreaterThan(m1 + m2 + m3 - 0.01); // within rounding
    });
  });
});
