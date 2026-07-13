/**
 * Tests for lease automation logic.
 *
 * Tests the exported pure helpers from leaseAutomation.api.ts:
 * - calculateNextEscalationDate(from, frequencyMonths) — date snapping logic
 *
 * Rent escalation dates must handle month-boundary edge cases:
 * - Standard months: Jan 15 + 12 months = Jan 15 next year
 * - Month overflow: Jan 31 + 1 month = Feb 28/29 (snap to last day)
 * - Year boundary: Oct 31 + 6 months = Apr 30
 * - Leap year: Jan 31, 2024 + 1 month = Feb 29
 */

import { leaseAutomationApi } from '../leaseAutomation.api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Helper: Create a Date at midnight local time from YYYY-MM-DD string
 * to match how the function creates dates internally.
 */
function date(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Lease Automation', () => {
  describe('calculateNextEscalationDate', () => {
    it('adds 12 months to a mid-month date correctly', () => {
      const from = date('2026-06-15');
      const result = leaseAutomationApi.calculateNextEscalationDate(from, 12);
      expect(result).toBe('2027-06-15');
    });

    it('adds 1 month without month-boundary issues for a mid-month date', () => {
      const from = date('2026-06-15');
      const result = leaseAutomationApi.calculateNextEscalationDate(from, 1);
      expect(result).toBe('2026-07-15');
    });

    it('snaps Jan 31 + 1 month to Feb 28 (non-leap year)', () => {
      const from = date('2026-01-31');
      const result = leaseAutomationApi.calculateNextEscalationDate(from, 1);
      // 2026 is not a leap year, so Feb has 28 days
      expect(result).toBe('2026-02-28');
    });

    it('snaps Jan 31 + 1 month to Feb 29 (leap year)', () => {
      const from = date('2024-01-31');
      const result = leaseAutomationApi.calculateNextEscalationDate(from, 1);
      // 2024 is a leap year, so Feb has 29 days
      expect(result).toBe('2024-02-29');
    });

    it('snaps Mar 31 + 1 month to Apr 30 (April has 30 days)', () => {
      const from = date('2026-03-31');
      const result = leaseAutomationApi.calculateNextEscalationDate(from, 1);
      expect(result).toBe('2026-04-30');
    });

    it('snaps Oct 31 + 6 months to Apr 30 (year boundary)', () => {
      const from = date('2026-10-31');
      const result = leaseAutomationApi.calculateNextEscalationDate(from, 6);
      expect(result).toBe('2027-04-30');
    });

    it('handles Jan 31 + 12 months returning to Jan 31 (no snap needed)', () => {
      const from = date('2026-01-31');
      const result = leaseAutomationApi.calculateNextEscalationDate(from, 12);
      // January has 31 days, so no snap needed
      expect(result).toBe('2027-01-31');
    });

    it('handles Feb 28 + 12 months = Feb 28 next year (no leap year)', () => {
      const from = date('2026-02-28');
      const result = leaseAutomationApi.calculateNextEscalationDate(from, 12);
      expect(result).toBe('2027-02-28');
    });

    it('snaps Dec 31 + 1 month to Jan 31 (year boundary, Jan has 31 days)', () => {
      const from = date('2026-12-31');
      const result = leaseAutomationApi.calculateNextEscalationDate(from, 1);
      // Dec 31 + 1 month -> Jan 31 (Jan has 31 days, so no snap)
      expect(result).toBe('2027-01-31');
    });

    it('handles 24-month (2-year) escalation correctly', () => {
      const from = date('2026-06-15');
      const result = leaseAutomationApi.calculateNextEscalationDate(from, 24);
      expect(result).toBe('2028-06-15');
    });

    it('snaps Aug 31 + 1 month to Sep 30 (September has 30 days)', () => {
      const from = date('2026-08-31');
      const result = leaseAutomationApi.calculateNextEscalationDate(from, 1);
      expect(result).toBe('2026-09-30');
    });

    it('preserves the original date (no mutation)', () => {
      const from = date('2026-01-31');
      const originalTime = from.getTime();
      leaseAutomationApi.calculateNextEscalationDate(from, 12);
      // Verify the input wasn't mutated
      expect(from.getTime()).toBe(originalTime);
    });
  });
});
