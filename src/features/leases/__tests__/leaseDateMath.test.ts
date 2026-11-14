// Unit tests for leaseDateMath (CT7-020 PR #196 round 2).
// SA review flagged three bugs in the inline logic:
//   - UTC round-trip changed the ISO day
//   - setMonth() overflowed on Jan 31 -> March 3
//   - end-date validation compared Date objects with different time components

import {
  toLocalIsoDate,
  fromLocalIsoDate,
  addOneCalendarMonth,
  isDateBefore,
} from '../utils/leaseDateMath';

describe('toLocalIsoDate', () => {
  it('formats a local midnight Date as the local calendar day', () => {
    // Build with LOCAL components so test is TZ-independent.
    expect(toLocalIsoDate(new Date(2026, 10, 7))).toBe('2026-11-07');
    expect(toLocalIsoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(toLocalIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('keeps the SAST calendar day between 00:00 and 02:00 (B9-005)', () => {
    // jest.config.js pins TZ to Africa/Johannesburg.
    // 01:00 SAST on 14 Nov is still 13 Nov in UTC.
    const oneAm = new Date('2026-11-13T23:00:00Z');
    expect(oneAm.getTimezoneOffset()).toBe(-120);
    expect(oneAm.toISOString().split('T')[0]).toBe('2026-11-13');
    expect(toLocalIsoDate(oneAm)).toBe('2026-11-14');
  });

  it('pads single-digit months and days', () => {
    expect(toLocalIsoDate(new Date(2026, 2, 5))).toBe('2026-03-05');
    expect(toLocalIsoDate(new Date(2026, 8, 9))).toBe('2026-09-09');
  });
});

describe('fromLocalIsoDate / toLocalIsoDate round trip', () => {
  it('round-trips without changing the calendar day', () => {
    for (const iso of ['2026-01-01', '2026-02-28', '2026-11-07', '2026-12-31']) {
      expect(toLocalIsoDate(fromLocalIsoDate(iso))).toBe(iso);
    }
  });

  it('fromLocalIsoDate builds a LOCAL midnight (not UTC midnight)', () => {
    const d = fromLocalIsoDate('2026-11-07');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10); // November is 10
    expect(d.getDate()).toBe(7);
    expect(d.getHours()).toBe(0);
  });
});

describe('addOneCalendarMonth', () => {
  it('normal case: Nov 7 -> Dec 7', () => {
    const r = addOneCalendarMonth(new Date(2026, 10, 7));
    expect(toLocalIsoDate(r)).toBe('2026-12-07');
  });

  it('clamps Jan 31 to Feb 28 in a non-leap year (does NOT overflow to March)', () => {
    const r = addOneCalendarMonth(new Date(2027, 0, 31));
    expect(toLocalIsoDate(r)).toBe('2027-02-28');
  });

  it('clamps Jan 31 to Feb 29 in a leap year', () => {
    const r = addOneCalendarMonth(new Date(2028, 0, 31));
    expect(toLocalIsoDate(r)).toBe('2028-02-29');
  });

  it('clamps Mar 31 to Apr 30 (not May 1)', () => {
    const r = addOneCalendarMonth(new Date(2026, 2, 31));
    expect(toLocalIsoDate(r)).toBe('2026-04-30');
  });

  it('rolls year over at December', () => {
    const r = addOneCalendarMonth(new Date(2026, 11, 15));
    expect(toLocalIsoDate(r)).toBe('2027-01-15');
  });
});

describe('isDateBefore', () => {
  // Stronger fixture: a broken timestamp-only implementation
  // (candidateMs < minimumMs) would return TRUE here because 00:00 is
  // before 23:59 on the same day. The correct day-stripped impl
  // returns FALSE because they share the same calendar day. This test
  // distinguishes the two.
  it('returns false for earlier TIME on the same calendar day', () => {
    const minimumLateInDay = new Date(2026, 10, 7, 23, 59, 59);
    const candidateEarlyInDay = new Date(2026, 10, 7, 0, 0, 0);
    expect(isDateBefore(candidateEarlyInDay, minimumLateInDay)).toBe(false);
  });

  // Symmetric check — the converse pair of timestamps (later time of
  // candidate day, earlier time of minimum day) must still correctly
  // report candidate as before when the DAY is before, independent of
  // time components.
  it('returns true when candidate day is strictly earlier regardless of time', () => {
    const candidateLateOnPrevDay = new Date(2026, 10, 6, 23, 59, 59);
    const minimumEarlyOnNextDay = new Date(2026, 10, 7, 0, 0, 1);
    expect(isDateBefore(candidateLateOnPrevDay, minimumEarlyOnNextDay)).toBe(true);
  });

  it('returns false when candidate day is the same', () => {
    expect(isDateBefore(new Date(2026, 10, 7), new Date(2026, 10, 7))).toBe(false);
  });

  it('accepts YYYY-MM-DD strings as candidate', () => {
    expect(isDateBefore('2026-11-06', new Date(2026, 10, 7))).toBe(true);
    expect(isDateBefore('2026-11-08', new Date(2026, 10, 7))).toBe(false);
  });
});
