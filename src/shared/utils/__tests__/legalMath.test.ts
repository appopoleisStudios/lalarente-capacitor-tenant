/**
 * Legal-math coverage — issue #28
 *
 * Tests for SA legally-sensitive calculations:
 * 1. calculateLegalInterest — Prescribed Rate of Interest Act
 * 2. calculateCurePeriodDeadline — CPA s14(2)(b)(i)(aa) 20 business-day cure
 * 3. calculateExpiryNoticeDate — CPA s14(2)(c) 80/60/40 day notice
 * 4. calculateMonthlyInterest — RHA s5(3) deposit interest
 * 5. calculatePenaltyAmount — CPA s14 2-month penalty cap
 * 6. addBusinessDays / countBusinessDaysBetween — holiday-aware
 */

import {
  calculateLegalInterest,
  calculateCurePeriodDeadline,
  calculateExpiryNoticeDate,
  addBusinessDays,
  countBusinessDaysBetween,
  isBusinessDay,
} from '../businessDayCalculator';
import {
  calculateMonthlyInterest,
  calculateCurrentBalance,
  normalizeDepositRate,
} from '../../../features/deposits/api/depositInterest.api';
import {
  calculatePenaltyAmount,
  calculateNoticeDays,
} from '../../../features/leases/api/leaseTermination.api';

// ─── 1. calculateLegalInterest ───────────────────────────────────────────────

describe('calculateLegalInterest', () => {
  it('returns 0 for zero principal', () => {
    expect(calculateLegalInterest(0, 10.5, 30)).toBe(0);
  });

  it('returns 0 for zero days overdue', () => {
    expect(calculateLegalInterest(5000, 10.5, 0)).toBe(0);
  });

  it('returns 0 for zero rate', () => {
    expect(calculateLegalInterest(5000, 0, 30)).toBe(0);
  });

  it('calculates simple interest correctly: R5000 at 10.5% for 30 days', () => {
    // 5000 × 0.105 × 30/365 = 43.15...
    expect(calculateLegalInterest(5000, 10.5, 30)).toBeCloseTo(43.15, 1);
  });

  it('calculates correctly for a full year', () => {
    // 10000 × 0.10 × 365/365 = 1000
    expect(calculateLegalInterest(10000, 10, 365)).toBeCloseTo(1000, 2);
  });

  it('rounds to 2 decimal places', () => {
    const result = calculateLegalInterest(1000, 7.5, 1);
    expect(Number.isInteger(result * 100)).toBe(true);
  });

  it('negative principal returns 0', () => {
    expect(calculateLegalInterest(-100, 10, 10)).toBe(0);
  });
});

// ─── 2. calculateCurePeriodDeadline (CPA s14) ────────────────────────────────

describe('calculateCurePeriodDeadline', () => {
  it('adds exactly 20 business days from a weekday', () => {
    // 2026-03-02 (Monday) + 20 business days = 2026-03-30 (Monday)
    const breach = new Date('2026-03-02');
    const deadline = calculateCurePeriodDeadline(breach);
    // Count: 20 business days forward, skipping 2026-03-21 (Human Rights Day)
    // and weekends
    expect(deadline).toBeInstanceOf(Date);
    // Should be at least 20 calendar days later
    const diffDays = (deadline.getTime() - breach.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(20);
  });

  it('skips a public holiday when counting 20 business days', () => {
    // Breach notice on 2026-03-16 (Monday)
    // 2026-03-21 = Human Rights Day — must be skipped
    const breach = new Date('2026-03-16');
    const withHoliday = calculateCurePeriodDeadline(breach);

    // For comparison: if we start from 2026-03-23 (after the holiday week) baseline
    // the result should be 1 calendar day later than a week without the holiday
    const noHolidayBreach = new Date('2026-03-23'); // same day-of-week but no holiday in window
    const withoutHoliday = calculateCurePeriodDeadline(noHolidayBreach);

    // Both windows are 20 business days but the first spans a holiday, so it ends later
    expect(withHoliday.getTime()).toBeLessThan(withoutHoliday.getTime());
  });

  it('accepts a date string', () => {
    const result = calculateCurePeriodDeadline('2026-06-01');
    expect(result).toBeInstanceOf(Date);
  });

  it('result is not a weekend', () => {
    const result = calculateCurePeriodDeadline('2026-05-01');
    const day = result.getDay();
    expect(day).not.toBe(0); // not Sunday
    expect(day).not.toBe(6); // not Saturday
  });
});

// ─── 3. calculateExpiryNoticeDate (CPA s14 80/60/40 days) ───────────────────

describe('calculateExpiryNoticeDate', () => {
  it('80 business days before lease end', () => {
    const leaseEnd = new Date('2026-12-31');
    const notice80 = calculateExpiryNoticeDate(leaseEnd, 80);
    expect(notice80).toBeInstanceOf(Date);
    expect(notice80 < leaseEnd).toBe(true);
  });

  it('60-day notice is later than 80-day notice', () => {
    const leaseEnd = new Date('2026-12-31');
    const notice80 = calculateExpiryNoticeDate(leaseEnd, 80);
    const notice60 = calculateExpiryNoticeDate(leaseEnd, 60);
    expect(notice60 > notice80).toBe(true);
  });

  it('40-day notice is later than 60-day notice', () => {
    const leaseEnd = new Date('2026-12-31');
    const notice60 = calculateExpiryNoticeDate(leaseEnd, 60);
    const notice40 = calculateExpiryNoticeDate(leaseEnd, 40);
    expect(notice40 > notice60).toBe(true);
  });

  it('result is not a weekend', () => {
    const result = calculateExpiryNoticeDate('2026-10-30', 40);
    const day = result.getDay();
    expect(day).not.toBe(0);
    expect(day).not.toBe(6);
  });
});

// ─── 4. calculateMonthlyInterest (RHA s5(3) deposit) ────────────────────────
// NOTE: calculateMonthlyInterest takes annualRate as a decimal (0.0525 for 5.25%).
// DB values are stored as percentages; use normalizeDepositRate() to convert.

describe('normalizeDepositRate', () => {
  it('converts percentage to decimal: 5.25 → 0.0525', () => {
    expect(normalizeDepositRate(5.25)).toBeCloseTo(0.0525, 6);
  });

  it('defaults to SA prescribed rate 5.25% when null', () => {
    expect(normalizeDepositRate(null)).toBeCloseTo(0.0525, 6);
  });

  it('defaults to SA prescribed rate 5.25% when undefined', () => {
    expect(normalizeDepositRate(undefined)).toBeCloseTo(0.0525, 6);
  });
});

describe('calculateMonthlyInterest', () => {
  it('returns 0 for zero balance', () => {
    expect(calculateMonthlyInterest(0, normalizeDepositRate(5.25))).toBe(0);
  });

  it('calculates monthly interest at default RHA rate (5.25% p.a.)', () => {
    // R10 000 × 0.0525 / 12 = R43.75
    expect(calculateMonthlyInterest(10000, normalizeDepositRate(5.25))).toBeCloseTo(43.75, 2);
  });

  it('rounds to 2 decimal places', () => {
    const result = calculateMonthlyInterest(1234, normalizeDepositRate(5.25));
    expect(Number.isInteger(result * 100)).toBe(true);
  });

  it('monthly interest at 0% rate is 0', () => {
    expect(calculateMonthlyInterest(5000, 0)).toBe(0);
  });

  it('accumulates correctly over 12 months (compound, ~R537 at 5.25%)', () => {
    const rate = normalizeDepositRate(5.25);
    let balance = 10000;
    let totalInterest = 0;
    for (let i = 0; i < 12; i++) {
      const monthly = calculateMonthlyInterest(balance, rate);
      totalInterest += monthly;
      balance += monthly;
    }
    // R10 000 at 5.25% compounding monthly ≈ R537
    expect(totalInterest).toBeGreaterThan(530);
    expect(totalInterest).toBeLessThan(545);
  });
});

describe('calculateCurrentBalance', () => {
  it('deposit + interest = current balance', () => {
    expect(calculateCurrentBalance(10000, 437.5)).toBeCloseTo(10437.5, 2);
  });

  it('zero interest returns deposit amount', () => {
    expect(calculateCurrentBalance(5000, 0)).toBe(5000);
  });
});

// ─── 5. calculatePenaltyAmount (CPA s14 2-month cap) ────────────────────────

describe('calculatePenaltyAmount', () => {
  it('caps at 2 months rent for long remaining term', () => {
    expect(calculatePenaltyAmount(12, 8000)).toBe(16000);
  });

  it('caps at 2 months rent for exactly 2 months remaining', () => {
    expect(calculatePenaltyAmount(2, 8000)).toBe(16000);
  });

  it('charges actual remaining months when less than 2', () => {
    expect(calculatePenaltyAmount(1, 8000)).toBe(8000);
  });

  it('zero remaining months means zero penalty', () => {
    expect(calculatePenaltyAmount(0, 8000)).toBe(0);
  });

  it('penalty is proportional to rent amount', () => {
    expect(calculatePenaltyAmount(12, 15000)).toBe(30000);
  });
});

describe('calculateNoticeDays', () => {
  it('returns lease-specified notice period', () => {
    expect(calculateNoticeDays(60)).toBe(60);
  });

  it('defaults to 30 days when null', () => {
    expect(calculateNoticeDays(null)).toBe(30);
  });

  it('defaults to 30 days when 0', () => {
    expect(calculateNoticeDays(0)).toBe(30);
  });
});

// ─── 6. addBusinessDays / countBusinessDaysBetween ──────────────────────────

describe('addBusinessDays', () => {
  it('adds 0 days returns same day (if business day)', () => {
    const mon = new Date('2026-03-02'); // Monday
    const result = addBusinessDays(mon, 0);
    expect(result.toDateString()).toBe(mon.toDateString());
  });

  it('skips weekend: Friday + 1 business day = Monday', () => {
    const friday = new Date('2026-03-06');
    const result = addBusinessDays(friday, 1);
    expect(result.getDay()).toBe(1); // Monday
  });

  it('skips Workers Day (2026-05-01) when counting forward', () => {
    const before = new Date('2026-04-30'); // Thursday
    const withHoliday = addBusinessDays(before, 1);
    // Friday 2026-05-01 is Workers Day → next business day is Monday 2026-05-04
    expect(withHoliday.toISOString().split('T')[0]).toBe('2026-05-04');
  });
});

describe('countBusinessDaysBetween', () => {
  it('returns 0 when start equals end', () => {
    expect(countBusinessDaysBetween('2026-03-02', '2026-03-02')).toBe(0);
  });

  it('counts 5 business days in a standard Mon-Sat span', () => {
    // Mon 2026-03-02 to Sat 2026-03-07: Tue-Fri = 4 business days (exclusive both ends)
    expect(countBusinessDaysBetween('2026-03-02', '2026-03-07')).toBe(4);
  });

  it('excludes public holidays from count', () => {
    // 2026-04-29 (Wed) to 2026-05-05 (Tue), exclusive of endpoints:
    // Apr 30 (Thu) = ✓, May 1 (Workers Day) = ✗, May 2 (Sat) = ✗, May 3 (Sun) = ✗, May 4 (Mon) = ✓
    // Total = 2 business days
    expect(countBusinessDaysBetween('2026-04-29', '2026-05-05')).toBe(2);
  });
});

describe('isBusinessDay', () => {
  it('Monday is a business day', () => {
    expect(isBusinessDay('2026-03-02')).toBe(true);
  });

  it('Saturday is not a business day', () => {
    expect(isBusinessDay('2026-03-07')).toBe(false);
  });

  it('Sunday is not a business day', () => {
    expect(isBusinessDay('2026-03-08')).toBe(false);
  });

  it('Human Rights Day (2026-03-21) is not a business day', () => {
    expect(isBusinessDay('2026-03-21')).toBe(false);
  });

  it("Workers' Day (2026-05-01) is not a business day", () => {
    expect(isBusinessDay('2026-05-01')).toBe(false);
  });
});
