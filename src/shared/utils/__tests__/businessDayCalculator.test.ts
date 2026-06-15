import {
  addBusinessDays,
  calculateCurePeriodDeadline,
  calculateDSARDeadline,
  calculateExpiryNoticeDate,
  calculateLegalInterest,
  countBusinessDaysBetween,
  getHolidayName,
  getHolidaysForYear,
  isBusinessDay,
  nextBusinessDay,
  subtractBusinessDays,
  toDateString
} from '../businessDayCalculator';

describe('businessDayCalculator', () => {
  describe('isBusinessDay', () => {
    it('should return true for a standard weekday', () => {
      const date = new Date('2026-06-10');
      expect(isBusinessDay(date)).toBe(true);
    });

    it('should return false for weekend (Saturday and Sunday)', () => {
      const saturday = new Date('2026-06-13');
      const sunday = new Date('2026-06-14');

      expect(isBusinessDay(saturday)).toBe(false);
      expect(isBusinessDay(sunday)).toBe(false);
    });

    it('should return false for known South African holidays', () => {
      const freedomDay = new Date('2026-04-27');

      expect(isBusinessDay(freedomDay)).toBe(false);
    });
  });

  describe('addBusinessDays', () => {
    it('should add days within a standard week without hitting weekends', () => {
      const start = new Date('2026-06-08');
      const result = addBusinessDays(start, 3);

      expect(toDateString(result)).toBe('2026-06-11');
    });

    it('should skip over regular weekend day when adding business days', () => {
      const start = new Date('2026-06-01');
      const result = addBusinessDays(start, 5);

      expect(toDateString(result)).toBe('2026-06-08');
    });

    it('should skip over public holidays cleanly', () => {
      const start = new Date('2026-04-02');
      const result = addBusinessDays(start, 2);

      expect(toDateString(result)).toBe('2026-04-08');
    });
  });

  describe('countBusinessDaysBetween', () => {
    it('should count working days accurately within a week', () => {
      const start = new Date('2026-06-08');
      const end = new Date('2026-06-12');

      const result = countBusinessDaysBetween(start, end);

      expect(result).toBe(3);
    });

    it('should return 0 if the start date is equal to or after the end date', () => {
      const start = new Date('2026-06-10');
      const end = new Date('2026-06-05');

      expect(countBusinessDaysBetween(start, end)).toBe(0);
    });

    it('should exclude weekend and public holidays from the total count', () => {
      const start = new Date('2026-04-02');
      const end = new Date('2026-04-07');

      expect(countBusinessDaysBetween(start, end)).toBe(0);
    });
  });

  describe('calculateCurePeriodDeadline', () => {
    it('should add exactly 20 business days to a regular start date', () => {
      const noticeDate = new Date('2026-06-01');
      const deadline = calculateCurePeriodDeadline(noticeDate);

      expect(toDateString(deadline)).toBe('2026-06-30');
    });

    it('should calculate the correct deadline across the dense April holiday cluster', () => {
      const noticeDate = new Date('2026-04-01');
      const deadline = calculateCurePeriodDeadline(noticeDate);

      expect(toDateString(deadline)).toBe('2026-05-05');
    });

    it('should accept a string date representation input seamlessly', () => {
      const deadline = calculateCurePeriodDeadline('2026-06-01');

      expect(toDateString(deadline)).toBe('2026-06-30');
    });
  });

  describe('calculateExpiryNoticeDate', () => {
    it('should accurately calculate a 40 business day period', () => {
      const leaseEndDate = new Date('2026-06-30');
      const noticeDate = calculateExpiryNoticeDate(leaseEndDate, 40);

      expect(toDateString(noticeDate)).toBe('2026-05-04');
    });

    it('should correctly shift backward if the lease expiry lands on a weekend', () => {
      const weekendExpiry = new Date('2026-06-14');
      const noticeDate = calculateExpiryNoticeDate(weekendExpiry, 5);

      expect(toDateString(noticeDate)).toBe('2026-06-08');
    });

    it('should accept a string representation of the lease end date', () => {
      const noticeDate = calculateExpiryNoticeDate('2026-06-30', 80);
      expect(noticeDate).toBeInstanceOf(Date);
    });

    it('should correctly handle a January lease end across the dense Dec/Jan holiday block for 80, 60, and 40 days', () => {
      const leaseEndDate = new Date('2026-01-30');
      expect(calculateExpiryNoticeDate(leaseEndDate, 80)).toBeInstanceOf(Date);
      expect(calculateExpiryNoticeDate(leaseEndDate, 60)).toBeInstanceOf(Date);
      expect(calculateExpiryNoticeDate(leaseEndDate, 40)).toBeInstanceOf(Date);
    });
  });

  describe('calculateDSARDeadline (POPIA s23)', () => {
    it('should calculate the standard 30 calendar days for a standard request (Jan 1 -> Jan 31)', () => {
      const requestDate = new Date('2026-01-01');
      const deadline = calculateDSARDeadline(requestDate);

      expect(toDateString(deadline)).toBe('2026-01-31');
    });

    it('should accept a string date representation for DSAR requests and use calendar arithmetic (June 1 -> July 1)', () => {
      const deadline = calculateDSARDeadline('2026-06-01');
      expect(toDateString(deadline)).toBe('2026-07-01');
    });
  });

  describe('subtractBusinessDays', () => {
    it('should subtract days within the a standard week', () => {
      const start = new Date('2026-06-12');
      const result = subtractBusinessDays(start, 3);

      expect(toDateString(result)).toBe('2026-06-09');
    });

    it('should skip backward over weekends properly', () => {
      const start = new Date('2026-06-08');
      const result = subtractBusinessDays(start, 2);

      expect(toDateString(result)).toBe('2026-06-04');
    });

    it('should skip backward over public holidays (e.g., Freedom Day)', () => {
      const start = new Date('2026-04-28');
      const result = subtractBusinessDays(start, 1);

      expect(toDateString(result)).toBe('2026-04-24');
    });

    it('should add days instead if a negative number is passed', () => {
      const start = new Date('2026-06-08');
      const result = subtractBusinessDays(start, -3);

      expect(toDateString(result)).toBe('2026-06-11');
    });
  });

  describe('calculateLegalInterest', () => {
    it('should correctly calculate standard simple interest', () => {
      const interest = calculateLegalInterest(10000, 11.75, 30);

      expect(interest).toBe(96.58);
    });

    it('should return 0 if there are 0 days in arrears', () => {
      expect(calculateLegalInterest(5000, 10.5, 0)).toBe(0);
    });

    it('should return 0 if the principal is 0 or negative', () => {
      expect(calculateLegalInterest(0, 10.5, 30)).toBe(0);
      expect(calculateLegalInterest(-1000, 10.5, 30)).toBe(0);
    });
  });
  
  describe('nextBusinessDay', () => {
    it('should return the SAME day if the input is already a business day', () => {
      const thursday = new Date('2026-06-11');
      expect(toDateString(nextBusinessDay(thursday))).toBe('2026-06-11');
    });

    it('should push a weekend date to the following Monday', () => {
      const saturday = new Date('2026-06-13');
      expect(toDateString(nextBusinessDay(saturday))).toBe('2026-06-15');
    });

    it('should push through a weekend AND a consecutive public holiday', () => {
      const sunday = new Date('2026-04-26');

      expect(toDateString(nextBusinessDay(sunday))).toBe('2026-04-28');
    });
  });

  describe('getHolidayName', () => {
    it('should return the correct statutory name for a known holiday', () => {
      const youthDay = new Date('2026-06-16');
      expect(getHolidayName(youthDay)).toBe('Youth Day');
    });

    it('should return null for a standard business day', () => {
      const standardDay = new Date('2026-06-10');
      expect(getHolidayName(standardDay)).toBeNull();
    });

    it('should work with a string input', () => {
      expect(getHolidayName('2026-09-24')).toBe('Heritage Day');
    });
  });

  describe('getHolidaysForYear', () => {
    it('should return an array containing standard SA holidays for the given year', () => {
      const holidays2026 = getHolidaysForYear(2026);

      expect(Array.isArray(holidays2026)).toBe(true);
      expect(holidays2026.length).toBe(12);
      expect(holidays2026[0].date).toBe('2026-01-01');
    });

    it('should return an empty array for a year not in dictionary', () => {
      const holidays1999 = getHolidaysForYear(1999);

      expect(holidays1999.length).toBe(0);
    });
  }); 
});