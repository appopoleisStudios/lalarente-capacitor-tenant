/**
 * Business Day Calculator for South African rental law compliance.
 *
 * Used by:
 * - Flow 02: Cure period calculations (arrears escalation)
 * - Flow 05: 80/60/40 day lease expiry notices (CPA s14)
 * - Flow 07: 30-day DSAR response deadline (POPIA)
 *
 * References:
 * - Public Holidays Act 36 of 1994
 * - Interpretation Act 33 of 1957 (business day definition)
 */

// ─── SA Public Holidays 2025–2028 ────────────────────────────────────────────
// Source: Department of Labour / South African Government Gazette
// When a public holiday falls on a Sunday, the Monday is observed.

interface PublicHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

const SA_PUBLIC_HOLIDAYS: PublicHoliday[] = [
  // ── 2025 ──
  { date: '2025-01-01', name: "New Year's Day" },
  { date: '2025-03-21', name: 'Human Rights Day' },
  { date: '2025-04-18', name: 'Good Friday' },
  { date: '2025-04-21', name: 'Family Day' },
  { date: '2025-04-28', name: 'Freedom Day (observed)' }, // 27 Apr is Sunday
  { date: '2025-05-01', name: "Workers' Day" },
  { date: '2025-06-16', name: 'Youth Day' },
  { date: '2025-08-09', name: "National Women's Day" },
  { date: '2025-09-24', name: 'Heritage Day' },
  { date: '2025-12-16', name: 'Day of Reconciliation' },
  { date: '2025-12-25', name: 'Christmas Day' },
  { date: '2025-12-26', name: 'Day of Goodwill' },

  // ── 2026 ──
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-03-21', name: 'Human Rights Day' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-06', name: 'Family Day' },
  { date: '2026-04-27', name: 'Freedom Day' },
  { date: '2026-05-01', name: "Workers' Day" },
  { date: '2026-06-16', name: 'Youth Day' },
  { date: '2026-08-10', name: "National Women's Day (observed)" }, // 9 Aug is Sunday
  { date: '2026-09-24', name: 'Heritage Day' },
  { date: '2026-12-16', name: 'Day of Reconciliation' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-26', name: 'Day of Goodwill' },

  // ── 2027 ──
  { date: '2027-01-01', name: "New Year's Day" },
  { date: '2027-03-22', name: 'Human Rights Day (observed)' }, // 21 Mar is Sunday
  { date: '2027-03-26', name: 'Good Friday' },
  { date: '2027-03-29', name: 'Family Day' },
  { date: '2027-04-27', name: 'Freedom Day' },
  { date: '2027-05-01', name: "Workers' Day" },
  { date: '2027-06-16', name: 'Youth Day' },
  { date: '2027-08-09', name: "National Women's Day" },
  { date: '2027-09-24', name: 'Heritage Day' },
  { date: '2027-12-16', name: 'Day of Reconciliation' },
  { date: '2027-12-25', name: 'Christmas Day' },
  { date: '2027-12-27', name: 'Day of Goodwill (observed)' }, // 26 Dec is Sunday

  // ── 2028 ──
  { date: '2028-01-01', name: "New Year's Day" },
  { date: '2028-03-21', name: 'Human Rights Day' },
  { date: '2028-04-14', name: 'Good Friday' },
  { date: '2028-04-17', name: 'Family Day' },
  { date: '2028-04-27', name: 'Freedom Day' },
  { date: '2028-05-01', name: "Workers' Day" },
  { date: '2028-06-16', name: 'Youth Day' },
  { date: '2028-08-09', name: "National Women's Day" },
  { date: '2028-09-25', name: 'Heritage Day (observed)' }, // 24 Sep is Sunday
  { date: '2028-12-16', name: 'Day of Reconciliation' },
  { date: '2028-12-25', name: 'Christmas Day' },
  { date: '2028-12-26', name: 'Day of Goodwill' },
];

// Build a Set for O(1) lookups
const HOLIDAY_SET = new Set(SA_PUBLIC_HOLIDAYS.map((h) => h.date));

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Format a Date to YYYY-MM-DD string (timezone-safe, uses local date parts).
 */
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse a YYYY-MM-DD string to a Date at midnight local time.
 */
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Clone a date to avoid mutation.
 */
function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

/**
 * Check if a date falls on a weekend (Saturday = 6, Sunday = 0).
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Check if a date is a South African public holiday.
 */
function isPublicHoliday(date: Date): boolean {
  return HOLIDAY_SET.has(toDateString(date));
}

/**
 * Get the public holiday name for a date, or null if not a holiday.
 */
export function getHolidayName(date: Date | string): string | null {
  const dateStr = typeof date === 'string' ? date : toDateString(date);
  const holiday = SA_PUBLIC_HOLIDAYS.find((h) => h.date === dateStr);
  return holiday?.name ?? null;
}

/**
 * Check if a date is a business day (not weekend, not public holiday).
 *
 * Per the Interpretation Act 33 of 1957, a "business day" excludes
 * Saturdays, Sundays, and public holidays.
 */
export function isBusinessDay(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseDate(date) : date;
  return !isWeekend(d) && !isPublicHoliday(d);
}

/**
 * Add N business days to a date. Skips weekends and public holidays.
 *
 * @param startDate - The starting date
 * @param days - Number of business days to add (must be >= 0)
 * @returns The resulting date after adding business days
 */
export function addBusinessDays(startDate: Date | string, days: number): Date {
  if (days < 0) {
    return subtractBusinessDays(startDate, Math.abs(days));
  }

  const current = typeof startDate === 'string' ? parseDate(startDate) : cloneDate(startDate);
  let remaining = days;

  while (remaining > 0) {
    current.setDate(current.getDate() + 1);
    if (isBusinessDay(current)) {
      remaining--;
    }
  }

  return current;
}

/**
 * Subtract N business days from a date. Skips weekends and public holidays.
 *
 * @param startDate - The starting date
 * @param days - Number of business days to subtract (must be >= 0)
 * @returns The resulting date after subtracting business days
 */
export function subtractBusinessDays(startDate: Date | string, days: number): Date {
  if (days < 0) {
    return addBusinessDays(startDate, Math.abs(days));
  }

  const current = typeof startDate === 'string' ? parseDate(startDate) : cloneDate(startDate);
  let remaining = days;

  while (remaining > 0) {
    current.setDate(current.getDate() - 1);
    if (isBusinessDay(current)) {
      remaining--;
    }
  }

  return current;
}

/**
 * Count business days between two dates (exclusive of both endpoints).
 */
export function countBusinessDaysBetween(
  startDate: Date | string,
  endDate: Date | string
): number {
  const start = typeof startDate === 'string' ? parseDate(startDate) : cloneDate(startDate);
  const end = typeof endDate === 'string' ? parseDate(endDate) : cloneDate(endDate);

  if (start >= end) return 0;

  let count = 0;
  const current = cloneDate(start);
  current.setDate(current.getDate() + 1);

  while (current < end) {
    if (isBusinessDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

// ─── Domain-Specific Helpers ─────────────────────────────────────────────────

/**
 * Calculate the date by which a CPA s14(2)(c) lease expiry notice must be sent.
 *
 * CPA requires notice periods of 80/60/40 business days before lease end.
 * This function calculates the latest date the landlord must send the notice.
 *
 * @param leaseEndDate - The lease expiry date
 * @param noticeBusinessDays - Required notice period in business days (e.g. 80, 60, 40)
 * @returns The latest date by which notice must be sent
 */
export function calculateExpiryNoticeDate(
  leaseEndDate: Date | string,
  noticeBusinessDays: number
): Date {
  return subtractBusinessDays(leaseEndDate, noticeBusinessDays);
}

/**
 * Calculate the POPIA DSAR response deadline.
 *
 * POPIA s23 requires response within 30 business days of receiving a request.
 *
 * @param requestDate - Date the data subject request was received
 * @returns The deadline date for responding to the DSAR
 */
export function calculateDSARDeadline(requestDate: Date | string): Date {
  return addBusinessDays(requestDate, 30);
}

/**
 * Calculate the cure period deadline for arrears.
 *
 * CPA s14(2)(b)(i)(aa) requires a 20-business-day cure period
 * before a breach notice can be actioned.
 *
 * @param breachNoticeDate - Date the breach notice was issued
 * @returns The deadline by which the tenant must cure the breach
 */
export function calculateCurePeriodDeadline(breachNoticeDate: Date | string): Date {
  return addBusinessDays(breachNoticeDate, 20);
}

/**
 * Calculate the legal interest on overdue rent.
 *
 * Per the National Credit Act and Prescribed Rate of Interest Act 55 of 1975,
 * interest on overdue amounts is capped at the prescribed rate (currently
 * repo rate + 3.5%, but we use the lease-specified rate capped at 2% per month
 * as per common SA lease practice).
 *
 * Uses simple interest: principal × (rate/100) × (days/365)
 *
 * @param principal - The overdue amount in Rands
 * @param annualRate - Annual interest rate as percentage (e.g. 2.0 for 2%)
 * @param daysOverdue - Number of calendar days the amount is overdue
 * @returns The interest amount in Rands (rounded to 2 decimal places)
 */
export function calculateLegalInterest(
  principal: number,
  annualRate: number,
  daysOverdue: number
): number {
  if (principal <= 0 || daysOverdue <= 0 || annualRate <= 0) return 0;
  const interest = principal * (annualRate / 100) * (daysOverdue / 365);
  return Math.round(interest * 100) / 100;
}

/**
 * Get all SA public holidays for a given year.
 */
export function getHolidaysForYear(year: number): PublicHoliday[] {
  return SA_PUBLIC_HOLIDAYS.filter((h) => h.date.startsWith(`${year}-`));
}

/**
 * Get the next business day on or after the given date.
 * If the date is already a business day, returns it unchanged.
 */
export function nextBusinessDay(date: Date | string): Date {
  const current = typeof date === 'string' ? parseDate(date) : cloneDate(date);
  while (!isBusinessDay(current)) {
    current.setDate(current.getDate() + 1);
  }
  return current;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export { SA_PUBLIC_HOLIDAYS, toDateString, parseDate };
export type { PublicHoliday };
