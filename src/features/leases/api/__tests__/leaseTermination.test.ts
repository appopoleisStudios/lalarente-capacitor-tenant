/**
 * Tests for lease early termination penalty calculation.
 *
 * Tests the exported pure helpers from leaseTermination.api.ts:
 * - calculateRemainingMonths(endDate, today) — uses date-fns differenceInCalendarMonths
 * - calculatePenaltyAmount(remainingMonths, monthlyRent) — capped at 2 months
 * - calculateNoticeDays(leaseNoticePeriod) — defaults to 30
 *
 * CPA s14: Early termination penalty capped at reasonable amount.
 * Common SA practice: max 2 months rent penalty.
 */

import {
  calculateRemainingMonths,
  calculatePenaltyAmount,
  calculateNoticeDays,
} from '../leaseTermination.api';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Lease Termination Penalty', () => {
  describe('calculateRemainingMonths', () => {
    it('calculates remaining months for a lease ending in 12 months', () => {
      const today = new Date('2026-06-11T00:00:00Z');
      const endDate = new Date('2027-06-11T00:00:00Z');
      const remaining = calculateRemainingMonths(endDate, today);
      expect(remaining).toBe(12);
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

    it('handles lease ending mid-month', () => {
      const today = new Date('2026-06-11T00:00:00Z');
      const endDate = new Date('2026-08-15T00:00:00Z');
      // differenceInCalendarMonths(Aug 15, Jun 11) = 2
      expect(calculateRemainingMonths(endDate, today)).toBe(2);
    });
  });

  describe('calculatePenaltyAmount', () => {
    it('caps penalty at 2 months rent for leases with >2 months remaining', () => {
      expect(calculatePenaltyAmount(10, 5000)).toBe(10000); // 2 × R5,000
    });

    it('calculates penalty for exactly 2 months remaining', () => {
      expect(calculatePenaltyAmount(2, 5000)).toBe(10000);
    });

    it('calculates penalty for less than 2 months remaining', () => {
      expect(calculatePenaltyAmount(1, 5000)).toBe(5000);
    });

    it('returns 0 penalty when no months remaining', () => {
      expect(calculatePenaltyAmount(0, 5000)).toBe(0);
    });

    it('handles high-value rental properties', () => {
      // R25,000/month property with 6 months remaining
      expect(calculatePenaltyAmount(6, 25000)).toBe(50000); // 2 × R25,000
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
});
