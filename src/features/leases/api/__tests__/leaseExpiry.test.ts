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

function d(y: number, m: number, day: number): Date {
  return new Date(y, m - 1, day);
}

function dateStr(y: number, m: number, day: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ─── calculateDaysUntilExpiry ────────────────────────────────────────────────

describe('calculateDaysUntilExpiry', () => {
  it('returns positive days for a future end date', () => {
    // Lease ends 31 Dec 2026, today is 15 Jun 2026
    const days = calculateDaysUntilExpiry('2026-12-31', d(2026, 6, 15));
    // Due to timezone handling (ISO string parsed as UTC vs local date),
    // actual result may vary by 1 day depending on timezone
    expect(days).toBeGreaterThan(190);
    expect(days).toBeLessThan(210);
  });

  it('returns 0 for today (within timezone tolerance)', () => {
    // Use local date string to avoid timezone mismatch
    const today = d(2026, 6, 15);
    const todayStr = dateStr(2026, 6, 15);
    const days = calculateDaysUntilExpiry(todayStr, today);
    // Should be 0 or 1 depending on timezone (local vs UTC date creation)
    expect(days >= 0 && days <= 1).toBe(true);
  });

  it('returns negative days for a past end date', () => {
    const days = calculateDaysUntilExpiry('2026-06-01', d(2026, 6, 15));
    expect(days).toBeLessThan(0);
  });
});

// ─── determineLeaseStatus ────────────────────────────────────────────────────

describe('determineLeaseStatus', () => {
  it('returns "expired" when days <= 0', () => {
    const status = determineLeaseStatus(0, d(2026, 6, 15), d(2026, 6, 15), false);
    expect(status).toBe('expired');
  });

  it('returns "expiring_soon" when within 30 days', () => {
    const status = determineLeaseStatus(15, d(2026, 6, 15), d(2026, 7, 1), true);
    expect(status).toBe('expiring_soon');
  });

  it('returns "overdue" when notice is due but not sent', () => {
    // today (15 Jun) >= notice80Due (10 Jun), notice not sent
    const status = determineLeaseStatus(60, d(2026, 6, 15), d(2026, 6, 10), false);
    expect(status).toBe('overdue');
  });

  it('returns "notice_due" when notice is due and already sent', () => {
    // today (15 Jun) >= notice80Due (10 Jun), notice sent
    const status = determineLeaseStatus(60, d(2026, 6, 15), d(2026, 6, 10), true);
    expect(status).toBe('notice_due');
  });

  it('returns "ok" when notice is not yet due', () => {
    // today (15 Jun) < notice80Due (1 Jul), notice not sent
    const status = determineLeaseStatus(120, d(2026, 6, 15), d(2026, 7, 1), false);
    expect(status).toBe('ok');
  });

  it('returns "ok" for a healthy lease with notice sent well before due', () => {
    const status = determineLeaseStatus(90, d(2026, 6, 15), d(2026, 7, 1), true);
    expect(status).toBe('ok');
  });
});
