/**
 * Tests for the SA Business Day Calculator.
 *
 * Tests the exported pure functions from businessDayCalculator.ts:
 * - isBusinessDay / isWeekend / isPublicHoliday
 * - addBusinessDays / subtractBusinessDays
 * - countBusinessDaysBetween
 * - calculateExpiryNoticeDate (CPA 80/60/40 day notices)
 * - calculateLegalInterest
 * - calculateCurePeriodDeadline
 * - calculateDSARDeadline
 * - nextBusinessDay
 */

import {
  isBusinessDay,
  addBusinessDays,
  subtractBusinessDays,
  countBusinessDaysBetween,
  calculateExpiryNoticeDate,
  calculateLegalInterest,
  calculateCurePeriodDeadline,
  calculateDSARDeadline,
  nextBusinessDay,
  getHolidayName,
  toDateString,
} from '../businessDayCalculator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a Date at midnight local time. */
function d(y: number, m: number, day: number): Date {
  return new Date(y, m - 1, day);
}

// ─── isBusinessDay ───────────────────────────────────────────────────────────

describe('isBusinessDay', () => {
  it('returns true for a regular weekday (Monday)', () => {
    // Monday 15 June 2026
    expect(isBusinessDay(d(2026, 6, 15))).toBe(true);
  });

  it('returns false for a Saturday', () => {
    expect(isBusinessDay(d(2026, 6, 13))).toBe(false); // Saturday
  });

  it('returns false for a Sunday', () => {
    expect(isBusinessDay(d(2026, 6, 14))).toBe(false); // Sunday
  });

  it('returns false for a public holiday (Christmas)', () => {
    expect(isBusinessDay(d(2026, 12, 25))).toBe(false);
  });

  it('returns false for an observed public holiday', () => {
    // National Women's Day 2026 observed on Monday 10 Aug (9 Aug is Sunday)
    expect(isBusinessDay(d(2026, 8, 10))).toBe(false);
  });

  it('accepts a YYYY-MM-DD string', () => {
    expect(isBusinessDay('2026-06-15')).toBe(true);  // Monday
    expect(isBusinessDay('2026-06-13')).toBe(false); // Saturday
  });

  it('returns false for New Years Day', () => {
    expect(isBusinessDay(d(2026, 1, 1))).toBe(false);
  });

  it('returns false for Youth Day (16 June)', () => {
    expect(isBusinessDay(d(2026, 6, 16))).toBe(false);
  });

  it('returns true for a non-holiday Friday', () => {
    expect(isBusinessDay(d(2026, 6, 12))).toBe(true); // Friday before weekend
  });
});

// ─── getHolidayName ──────────────────────────────────────────────────────────

describe('getHolidayName', () => {
  it('returns the name for a known holiday', () => {
    expect(getHolidayName('2026-12-25')).toBe('Christmas Day');
    expect(getHolidayName('2026-01-01')).toBe("New Year's Day");
  });

  it('returns null for a non-holiday', () => {
    expect(getHolidayName('2026-06-15')).toBeNull();
  });

  it('returns the name for an observed holiday', () => {
    expect(getHolidayName('2026-08-10')).toBe("National Women's Day (observed)");
  });

  it('returns Youth Day for 16 June', () => {
    expect(getHolidayName('2026-06-16')).toBe('Youth Day');
  });
});

// ─── addBusinessDays ─────────────────────────────────────────────────────────

describe('addBusinessDays', () => {
  it('adds 5 business days skipping weekend and Youth Day', () => {
    // Monday 15 Jun -> Youth Day Tue 16, skip weekend -> +4 biz days to Mon 22, +1 to Tue 23
    const result = addBusinessDays(d(2026, 6, 15), 5);
    expect(toDateString(result)).toBe('2026-06-23');
  });

  it('adds 0 business days returns the same date', () => {
    const result = addBusinessDays(d(2026, 6, 15), 0);
    expect(toDateString(result)).toBe('2026-06-15');
  });

  it('skips public holidays when counting', () => {
    // Thursday 24 Dec -> +2 business days
    // Skip Fri 25 (Christmas), Sat 26, Sun 27
    // Mon 28 = day 1, Tue 29 = day 2
    const result = addBusinessDays(d(2026, 12, 24), 2);
    expect(toDateString(result)).toBe('2026-12-29');
  });

  it('handles negative days by delegating to subtractBusinessDays', () => {
    // Mon 22 Jun -> -5 business days = Fri 12 Jun
    // (skipping Youth Day on Tue 16)
    const result = addBusinessDays(d(2026, 6, 22), -5);
    expect(toDateString(result)).toBe('2026-06-12');
  });

  it('accepts a string date', () => {
    // 15 Jun (Mon) + 3: skip 16 (Youth Day), 17 (Wed)=1, 18 (Thu)=2, 19 (Fri)=3
    const result = addBusinessDays('2026-06-15', 3);
    expect(toDateString(result)).toBe('2026-06-19');
  });
});

// ─── subtractBusinessDays ────────────────────────────────────────────────────

describe('subtractBusinessDays', () => {
  it('subtracts 5 business days skipping weekend and Youth Day', () => {
    // Monday 22 Jun -> -5 business days
    // 19 (Fri)=1, 18 (Thu)=2, 17 (Wed)=3, 16 (Youth Day skip), 15 (Mon)=4, 12 (Fri)=5
    const result = subtractBusinessDays(d(2026, 6, 22), 5);
    expect(toDateString(result)).toBe('2026-06-12');
  });

  it('subtracts 0 business days returns the same date', () => {
    const result = subtractBusinessDays(d(2026, 6, 15), 0);
    expect(toDateString(result)).toBe('2026-06-15');
  });

  it('skips public holidays when subtracting', () => {
    // Wednesday 30 Dec -> -2 business days
    // 29 (Tue)=1, 28 (Mon)=2
    const result = subtractBusinessDays(d(2026, 12, 30), 2);
    expect(toDateString(result)).toBe('2026-12-28');
  });

  it('handles negative days by delegating to addBusinessDays', () => {
    // Mon 15 Jun -> -(-5) = +5 business days = Tue 23 Jun
    const result = subtractBusinessDays(d(2026, 6, 15), -5);
    expect(toDateString(result)).toBe('2026-06-23');
  });
});

// ─── countBusinessDaysBetween ────────────────────────────────────────────────

describe('countBusinessDaysBetween', () => {
  it('counts business days between Mon 15 Jun and Mon 22 Jun', () => {
    // 15 Jun (Mon) start, 22 Jun (Mon) end
    // Between: 16(holiday), 17(Wed), 18(Thu), 19(Fri), 20-21(weekend) = 3 biz days
    expect(countBusinessDaysBetween(d(2026, 6, 15), d(2026, 6, 22))).toBe(3);
  });

  it('returns 0 when start >= end', () => {
    expect(countBusinessDaysBetween(d(2026, 6, 22), d(2026, 6, 15))).toBe(0);
    expect(countBusinessDaysBetween(d(2026, 6, 15), d(2026, 6, 15))).toBe(0);
  });
});

// ─── calculateExpiryNoticeDate (CPA s14) ─────────────────────────────────────

describe('calculateExpiryNoticeDate (CPA s14 notices)', () => {
  const leaseEnd = d(2026, 12, 31); // Thursday

  it('calculates 80 business day notice date', () => {
    const result = calculateExpiryNoticeDate(leaseEnd, 80);
    const resultStr = toDateString(result);
    // Just verify it's a valid date well before the end
    expect(new Date(resultStr).getTime()).toBeLessThan(leaseEnd.getTime());
  });

  it('calculates 60 business day notice date', () => {
    const result = calculateExpiryNoticeDate(leaseEnd, 60);
    const resultStr = toDateString(result);
    expect(new Date(resultStr).getTime()).toBeLessThan(leaseEnd.getTime());
  });

  it('calculates 40 business day notice date', () => {
    const result = calculateExpiryNoticeDate(leaseEnd, 40);
    const resultStr = toDateString(result);
    expect(new Date(resultStr).getTime()).toBeLessThan(leaseEnd.getTime());
  });

  it('ensures 80-day notice is earlier than 60-day notice', () => {
    const notice80 = calculateExpiryNoticeDate(leaseEnd, 80);
    const notice60 = calculateExpiryNoticeDate(leaseEnd, 60);
    expect(notice80.getTime()).toBeLessThan(notice60.getTime());
  });

  it('ensures 60-day notice is earlier than 40-day notice', () => {
    const notice60 = calculateExpiryNoticeDate(leaseEnd, 60);
    const notice40 = calculateExpiryNoticeDate(leaseEnd, 40);
    expect(notice60.getTime()).toBeLessThan(notice40.getTime());
  });
});

// ─── calculateLegalInterest ──────────────────────────────────────────────────

describe('calculateLegalInterest', () => {
  it('calculates interest for a standard arrears amount', () => {
    // R10,000 at 2% annual for 30 days
    const interest = calculateLegalInterest(10000, 2.0, 30);
    // 10000 * 0.02 * (30/365) = 10000 * 0.02 * 0.08219 = 16.44
    expect(interest).toBe(16.44);
  });

  it('returns zero when principal is zero', () => {
    expect(calculateLegalInterest(0, 2.0, 30)).toBe(0);
  });

  it('returns zero when days overdue is zero', () => {
    expect(calculateLegalInterest(10000, 2.0, 0)).toBe(0);
  });

  it('returns zero when rate is zero', () => {
    expect(calculateLegalInterest(10000, 0, 30)).toBe(0);
  });

  it('handles a large amount with high rate over short period', () => {
    // R500,000 at 10% for 7 days
    const interest = calculateLegalInterest(500000, 10.0, 7);
    // 500000 * 0.10 * (7/365) = 500000 * 0.10 * 0.01918 = 958.90
    expect(interest).toBe(958.9);
  });

  it('handles a small amount with low rate', () => {
    // R500 at 1.5% for 14 days
    const interest = calculateLegalInterest(500, 1.5, 14);
    // 500 * 0.015 * (14/365) = 0.29
    expect(interest).toBe(0.29);
  });

  it('returns 0 for negative principal or days', () => {
    expect(calculateLegalInterest(-100, 2.0, 30)).toBe(0);
    expect(calculateLegalInterest(10000, 2.0, -5)).toBe(0);
    expect(calculateLegalInterest(10000, -1, 30)).toBe(0);
  });
});

// ─── calculateCurePeriodDeadline ─────────────────────────────────────────────

describe('calculateCurePeriodDeadline', () => {
  it('calculates 20 business days from the breach notice date', () => {
    // Breach notice on Monday 15 Jun -> 20 business days
    // (skips Youth Day Tue 16, so takes 21 calendar days)
    const result = calculateCurePeriodDeadline(d(2026, 6, 15));
    const resultStr = toDateString(result);
    // July 14 is Tue (15 Jun + 20 biz days = ~21 calendar days due to Youth Day)
    expect(resultStr).toBe('2026-07-14');
  });

  it('accepts a string date', () => {
    const result = calculateCurePeriodDeadline('2026-06-15');
    expect(toDateString(result)).toBe('2026-07-14');
  });
});

// ─── calculateDSARDeadline ───────────────────────────────────────────────────

describe('calculateDSARDeadline (POPIA s23)', () => {
  it('calculates 30 business days from request date', () => {
    // DSAR received Monday 15 Jun -> 30 business days
    // (skips Youth Day Tue 16)
    const result = calculateDSARDeadline(d(2026, 6, 15));
    const resultStr = toDateString(result);
    expect(resultStr).toBe('2026-07-28');
  });
});

// ─── nextBusinessDay ─────────────────────────────────────────────────────────

describe('nextBusinessDay', () => {
  it('returns the same date if already a business day', () => {
    expect(toDateString(nextBusinessDay(d(2026, 6, 15)))).toBe('2026-06-15');
  });

  it('returns Monday for a Saturday', () => {
    expect(toDateString(nextBusinessDay(d(2026, 6, 13)))).toBe('2026-06-15');
  });

  it('returns Wednesday for Youth Day (Tuesday holiday)', () => {
    // 16 Jun 2026 is Tuesday (Youth Day)
    // Next business day is Wednesday 17 Jun
    expect(toDateString(nextBusinessDay(d(2026, 6, 16)))).toBe('2026-06-17');
  });
});
