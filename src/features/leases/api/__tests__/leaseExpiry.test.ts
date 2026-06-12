/**
 * Tests for lease expiry notice calculations (CPA s14(2)(c)).
 *
 * Tests the exported pure helpers from leaseExpiry.api.ts:
 * - calculateDaysUntilExpiry(endDate, today)
 * - determineLeaseStatus(daysUntilExpiry, today, notice80Due, notice80Sent)
 *
 * CPA requires notice at 80, 60, and 40 business days before lease end.
 */

import { calculateDaysUntilExpiry, determineLeaseStatus } from '../leaseExpiry.api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a Date at midnight UTC from YYYY-MM-DD (matches function's ISO parsing). */
function utcDate(isoStr: string): Date {
  return new Date(isoStr);
}

// ─── calculateDaysUntilExpiry ────────────────────────────────────────────────

describe('calculateDaysUntilExpiry', () => {
  it('calculates exact days between two dates (UTC-consistent)', () => {
    // Both dates constructed via YYYY-MM-DD string -> midnight UTC (same as function)
    const days = calculateDaysUntilExpiry('2026-12-31', utcDate('2026-06-15'));
    expect(days).toBe(199);
  });

  it('returns 0 for same date', () => {
    const days = calculateDaysUntilExpiry('2026-06-15', utcDate('2026-06-15'));
    expect(days).toBe(0);
  });

  it('returns negative for a past end date', () => {
    const days = calculateDaysUntilExpiry('2026-06-01', utcDate('2026-06-15'));
    expect(days).toBe(-14);
  });
});

// ─── determineLeaseStatus ────────────────────────────────────────────────────

describe('determineLeaseStatus', () => {
  it('returns "expired" when days <= 0', () => {
    const status = determineLeaseStatus(0, utcDate('2026-06-15'), utcDate('2026-06-15'), false);
    expect(status).toBe('expired');
  });

  it('returns "expiring_soon" when within 30 days', () => {
    const status = determineLeaseStatus(15, utcDate('2026-06-15'), utcDate('2026-07-01'), true);
    expect(status).toBe('expiring_soon');
  });

  it('returns "overdue" when notice is due but not sent', () => {
    // today (15 Jun) >= notice80Due (10 Jun), notice not sent
    const status = determineLeaseStatus(60, utcDate('2026-06-15'), utcDate('2026-06-10'), false);
    expect(status).toBe('overdue');
  });

  it('returns "notice_due" when notice is due and already sent', () => {
    // today (15 Jun) >= notice80Due (10 Jun), notice sent
    const status = determineLeaseStatus(60, utcDate('2026-06-15'), utcDate('2026-06-10'), true);
    expect(status).toBe('notice_due');
  });

  it('returns "ok" when notice is not yet due', () => {
    // today (15 Jun) < notice80Due (1 Jul), notice not sent
    const status = determineLeaseStatus(120, utcDate('2026-06-15'), utcDate('2026-07-01'), false);
    expect(status).toBe('ok');
  });

  it('returns "ok" for a healthy lease with notice sent well before due', () => {
    const status = determineLeaseStatus(90, utcDate('2026-06-15'), utcDate('2026-07-01'), true);
    expect(status).toBe('ok');
  });
});
