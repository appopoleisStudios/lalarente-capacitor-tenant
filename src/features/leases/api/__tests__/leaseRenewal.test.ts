/**
 * Tests for lease renewal negotiation logic.
 *
 * Renewal rounds increment with each counter-offer.
 * Response deadline: 7 days from proposal.
 * Renewal end date depends on duration (fixed-term vs month-to-month).
 *
 * Reference implementation pattern: src/features/payments/__tests__/paymentGateway.test.ts
 */

// ─── Pure calculation helpers (mirrors logic in leaseRenewal.api.ts) ─────────

function getNextRound(existingRound: number | null): number {
  return (existingRound || 0) + 1;
}

function calculateResponseDeadline(fromDate: Date): Date {
  const deadline = new Date(fromDate);
  deadline.setDate(deadline.getDate() + 7);
  return deadline;
}

function calculateRenewalEndDate(
  startDate: Date,
  durationMonths: number | null
): Date {
  if (durationMonths) {
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + durationMonths);
    return end;
  }
  // Month-to-month: 1 month
  const end = new Date(startDate);
  end.setMonth(end.getMonth() + 1);
  return end;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Lease Renewal Logic', () => {
  describe('getNextRound', () => {
    it('starts at round 1 for first renewal', () => {
      expect(getNextRound(null)).toBe(1);
      expect(getNextRound(0)).toBe(1);
    });

    it('increments round for counter-offers', () => {
      expect(getNextRound(1)).toBe(2);
      expect(getNextRound(3)).toBe(4);
    });
  });

  describe('calculateResponseDeadline', () => {
    it('sets deadline 7 days from now', () => {
      const now = new Date('2026-06-11T12:00:00Z');
      const deadline = calculateResponseDeadline(now);
      expect(deadline.toISOString().split('T')[0]).toBe('2026-06-18');
    });

    it('handles month boundaries correctly', () => {
      const endOfMonth = new Date('2026-06-28T12:00:00Z');
      const deadline = calculateResponseDeadline(endOfMonth);
      // June 28 + 7 days = July 5
      expect(deadline.toISOString().split('T')[0]).toBe('2026-07-05');
    });

    it('handles year boundaries', () => {
      const endOfYear = new Date('2026-12-28T12:00:00Z');
      const deadline = calculateResponseDeadline(endOfYear);
      // Dec 28 + 7 days = Jan 4, 2027
      expect(deadline.toISOString().split('T')[0]).toBe('2027-01-04');
    });
  });

  describe('calculateRenewalEndDate', () => {
    it('calculates end date for fixed-term renewal', () => {
      const start = new Date('2026-07-01T00:00:00Z');
      const end = calculateRenewalEndDate(start, 12);
      expect(end.toISOString().split('T')[0]).toBe('2027-07-01');
    });

    it('calculates end date for 6-month renewal', () => {
      const start = new Date('2026-07-01T00:00:00Z');
      const end = calculateRenewalEndDate(start, 6);
      expect(end.toISOString().split('T')[0]).toBe('2027-01-01');
    });

    it('sets 1 month for month-to-month (durationMonths = null)', () => {
      const start = new Date('2026-07-01T00:00:00Z');
      const end = calculateRenewalEndDate(start, null);
      expect(end.toISOString().split('T')[0]).toBe('2026-08-01');
    });
  });
});
