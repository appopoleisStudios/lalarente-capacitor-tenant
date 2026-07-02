/**
 * Tests for lease automation logic.
 *
 * Tests the pure helper method from leaseAutomation.api.ts:
 * - leaseAutomationApi.calculateNextEscalationDate(from, frequencyMonths)
 *
 * CPA s14: Rent escalation must be calculated at prescribed intervals.
 * Default frequency: 12 months.
 */

import { leaseAutomationApi } from '../leaseAutomation.api';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('leaseAutomationApi', () => {
  describe('calculateNextEscalationDate', () => {
    it('calculates next escalation date 12 months from now', () => {
      const from = new Date('2026-06-15');
      const nextDate = leaseAutomationApi.calculateNextEscalationDate(from, 12);
      expect(nextDate).toBe('2027-06-15');
    });

    it('calculates next escalation date for 6-month frequency', () => {
      const from = new Date('2026-06-15');
      const nextDate = leaseAutomationApi.calculateNextEscalationDate(from, 6);
      expect(nextDate).toBe('2026-12-15');
    });

    it('calculates next escalation date for 1-month frequency (monthly escalation)', () => {
      const from = new Date('2026-06-15');
      const nextDate = leaseAutomationApi.calculateNextEscalationDate(from, 1);
      expect(nextDate).toBe('2026-07-15');
    });

    it('handles year boundaries correctly', () => {
      const from = new Date('2026-10-01');
      const nextDate = leaseAutomationApi.calculateNextEscalationDate(from, 6);
      expect(nextDate).toBe('2027-04-01');
    });

    it('handles end-of-month date overflow gracefully', () => {
      // Jan 31 + 1 month = Feb 28 (non-leap year 2026)
      const from = new Date('2026-01-31');
      const nextDate = leaseAutomationApi.calculateNextEscalationDate(from, 1);
      // JS Date handles overflow: Jan 31 -> Feb 28 in 2026
      expect(nextDate).toBe('2026-02-28');
    });

    it('handles leap year February correctly', () => {
      // Jan 31 + 1 month in leap year 2028 = Feb 29
      const from = new Date('2028-01-31');
      const nextDate = leaseAutomationApi.calculateNextEscalationDate(from, 1);
      expect(nextDate).toBe('2028-02-29');
    });
  });
});
