import { formatCurrency, formatDate } from '../format';

describe('formatCurrency', () => {
  it('formats a typical rent amount', () => {
    const result = formatCurrency(10000);
    expect(result).toContain('10');
    expect(result).toContain('000');
    expect(result).toMatch(/R/);
  });

  it('renders two decimal places', () => {
    const result = formatCurrency(1234.5);
    expect(result).toContain('50');
  });

  it('returns R 0.00 for zero', () => {
    expect(formatCurrency(0)).toMatch(/0[,.]00/);
  });

  it('returns R 0.00 for null', () => {
    expect(formatCurrency(null)).toMatch(/0[,.]00/);
  });

  it('returns R 0.00 for undefined', () => {
    expect(formatCurrency(undefined)).toMatch(/0[,.]00/);
  });

  it('returns R 0.00 for NaN', () => {
    expect(formatCurrency(NaN)).toMatch(/0[,.]00/);
  });
});

describe('formatDate', () => {
  const ISO = '2026-03-15T12:00:00.000Z';

  it('short style contains day, abbreviated month, year', () => {
    const result = formatDate(ISO, 'short');
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2026/);
    expect(result).toBeTruthy();
  });

  it('long style contains full month name', () => {
    const result = formatDate(ISO, 'long');
    expect(result).toMatch(/2026/);
    expect(result.length).toBeGreaterThan(formatDate(ISO, 'short').length);
  });

  it('datetime style contains time digits', () => {
    const result = formatDate(ISO, 'datetime');
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it('defaults to short style', () => {
    expect(formatDate(ISO)).toBe(formatDate(ISO, 'short'));
  });

  it('accepts a Date object', () => {
    const d = new Date(2026, 2, 15); // local midnight 15 Mar 2026
    const result = formatDate(d, 'short');
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2026/);
  });

  it('returns empty string for null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('returns empty string for invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('');
  });
});
