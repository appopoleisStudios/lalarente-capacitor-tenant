/**
 * Rent roll status for one property (CT7-057).
 *
 * The rent roll used to call a rented property "paid" whenever its next
 * payment was more than five days away, or when it had no payments at all,
 * even if nothing had ever been paid. A new tenancy whose first rent is due
 * next month showed "Paid" while the owner had collected R 0 (Invoices and
 * Tax Reports agreed: R 0).
 *
 * Rules (rent rows of the active lease only; cancelled rows ignored):
 * - unpaid = pending, failed, or completed with an amount still outstanding
 *   (partial payment);
 * - processing: a tenant-submitted payment awaits the owner's confirmation;
 * - overdue: an unpaid row whose due date has passed;
 * - due soon: the next unpaid row is due within five days;
 * - paid: the latest rent that has fallen due is settled;
 * - upcoming: nothing has fallen due yet (new tenancy).
 * Due dates are calendar dates, compared with today's date in South Africa.
 */
export type RentRollStatus =
  | 'paid'
  | 'upcoming'
  | 'pending'
  | 'overdue'
  | 'processing'
  | 'no_lease';

export const RENT_ROLL_STATUS_LABEL: Record<RentRollStatus, string> = {
  paid: 'Paid',
  upcoming: 'Upcoming',
  pending: 'Due soon',
  overdue: 'Overdue',
  processing: 'Processing',
  no_lease: 'No lease',
};

/** Days before the due date at which an unpaid payment counts as due soon. */
export const DUE_SOON_DAYS = 5;

export interface RentPayment {
  status: string;
  /** SQL DATE, YYYY-MM-DD */
  due_date: string;
  amount: number;
  amount_outstanding?: number | null;
  type?: string | null;
  lease?: { status?: string | null } | null;
}

export interface RentSummary {
  status: RentRollStatus;
  /** due date of the next unpaid rent, if any */
  nextDue: string | null;
  overdueAmount: number;
}

const SAST_OFFSET_MS = 2 * 60 * 60 * 1000; // UTC+2, no daylight saving

/** Today's calendar date in South Africa, YYYY-MM-DD. */
export function saToday(now: Date = new Date()): string {
  return new Date(now.getTime() + SAST_OFFSET_MS).toISOString().slice(0, 10);
}

const day = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / 86_400_000;

const outstanding = (p: RentPayment) => Number(p.amount_outstanding ?? 0);

const isUnpaid = (p: RentPayment) =>
  p.status === 'pending' ||
  p.status === 'failed' ||
  (p.status === 'completed' && outstanding(p) > 0);

const owed = (p: RentPayment) => (outstanding(p) > 0 ? outstanding(p) : Number(p.amount) || 0);

export function summarizeRent(
  propertyStatus: string | null | undefined,
  payments: RentPayment[],
  today: string = saToday()
): RentSummary {
  if (propertyStatus !== 'rented') return { status: 'no_lease', nextDue: null, overdueAmount: 0 };

  const rent = payments.filter((p) => (p.type ?? 'rent') === 'rent' && p.status !== 'cancelled');
  // the active tenancy only: a previous tenant's rows never count (SA #262)
  const active = rent.filter((p) => p.lease?.status === 'active');

  const unpaid = active.filter(isUnpaid);
  const overdue = unpaid.filter((p) => day(p.due_date) < day(today));
  const next = unpaid
    .filter((p) => day(p.due_date) >= day(today))
    .sort((a, b) => day(a.due_date) - day(b.due_date))[0];
  const overdueAmount = overdue.reduce((sum, p) => sum + owed(p), 0);
  const nextDue = next?.due_date ?? null;
  const summary = (status: RentRollStatus): RentSummary => ({ status, nextDue, overdueAmount });

  if (active.some((p) => p.status === 'processing')) return summary('processing');
  if (overdue.length > 0) return summary('overdue');
  if (next && day(next.due_date) - day(today) <= DUE_SOON_DAYS) return summary('pending');

  const fallenDue = active
    .filter((p) => day(p.due_date) <= day(today))
    .sort((a, b) => day(b.due_date) - day(a.due_date));
  if (fallenDue.length > 0 && !isUnpaid(fallenDue[0]) && fallenDue[0].status === 'completed') {
    return summary('paid');
  }
  return summary('upcoming');
}

/**
 * Arrears across a portfolio, exactly as the Rent Roll shows them (CT7-063):
 * a property is in arrears when its Rent Roll status is "overdue", and the
 * amount is that property's overdue amount. The owner dashboard uses this so
 * its "In Arrears" and "Tenants In Arrears" figures match the Rent Roll.
 */
export function summarizeArrears(
  properties: { id: string; status?: string | null }[],
  payments: (RentPayment & { property_id?: string | null })[],
  today: string = saToday()
): { amount: number; count: number } {
  let amount = 0;
  let count = 0;
  for (const property of properties) {
    const rent = summarizeRent(
      property.status,
      payments.filter((p) => p.property_id === property.id),
      today
    );
    if (rent.status === 'overdue') {
      amount += rent.overdueAmount;
      count += 1;
    }
  }
  return { amount, count };
}
