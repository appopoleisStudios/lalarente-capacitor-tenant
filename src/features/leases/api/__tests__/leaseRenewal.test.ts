/**
 * Tests for lease renewal negotiation logic.
 *
 * Tests the exported pure helpers from leaseRenewal.api.ts:
 * - getNextRound(existingRound)
 * - calculateResponseDeadline(fromDate)
 * - calculateRenewalEndDate(startDate, durationMonths)
 *
 * Renewal rounds increment with each counter-offer.
 * Response deadline: 7 calendar days from proposal.
 * Renewal end date depends on duration (fixed-term vs month-to-month).
 */

import {
  getNextRound,
  calculateResponseDeadline,
  calculateRenewalEndDate,
} from '../leaseRenewal.api';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Lease Renewal Logic', () => {
  describe('getNextRound', () => {
    it('starts at round 1 for first renewal', () => {
      expect(getNextRound(null)).toBe(1);
      expect(getNextRound(0)).toBe(1);
    });

    it('increments round for counter-offers', () => {
      expect(getNextRound(1)).toBe(2);
      expect(getNextRound(3)).toBe(4);
    });
  });

  describe('calculateResponseDeadline', () => {
    it('sets deadline 7 days from now', () => {
      const now = new Date('2026-06-11T12:00:00Z');
      const deadline = calculateResponseDeadline(now);
      expect(deadline.split('T')[0]).toBe('2026-06-18');
    });

    it('handles month boundaries correctly', () => {
      const endOfMonth = new Date('2026-06-28T12:00:00Z');
      const deadline = calculateResponseDeadline(endOfMonth);
      // June 28 + 7 days = July 5
      expect(deadline.split('T')[0]).toBe('2026-07-05');
    });

    it('handles year boundaries', () => {
      const endOfYear = new Date('2026-12-28T12:00:00Z');
      const deadline = calculateResponseDeadline(endOfYear);
      // Dec 28 + 7 days = Jan 4, 2027
      expect(deadline.split('T')[0]).toBe('2027-01-04');
    });
  });

  describe('calculateRenewalEndDate', () => {
    it('calculates end date for 12-month fixed-term renewal', () => {
      const start = new Date('2026-07-01T00:00:00Z');
      const end = calculateRenewalEndDate(start, 12);
      expect(end).toBe('2027-07-01');
    });

    it('calculates end date for 6-month renewal', () => {
      const start = new Date('2026-07-01T00:00:00Z');
      const end = calculateRenewalEndDate(start, 6);
      expect(end).toBe('2027-01-01');
    });

    it('sets 1 month for month-to-month (durationMonths = null)', () => {
      const start = new Date('2026-07-01T00:00:00Z');
      const end = calculateRenewalEndDate(start, null);
      expect(end).toBe('2026-08-01');
    });
  });
});
