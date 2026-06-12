import {
    addBusinessDays,
    calculateCurePeriodDeadline,
    countBusinessDaysBetween,
    isBusinessDay,
    toDateString,
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

    it('should exclude weekend and public holidays from the total count ', () => { 
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
});
