/**
 * Rent roll status for one property (CT7-057).
 *
 * The rent roll used to call a rented property "paid" whenever its next
 * payment was more than five days away, or when it had no payments at all,
 * even if nothing had ever been paid. A new tenancy whose first rent is due
 * next month showed "Paid" while the owner had collected R 0 (Invoices and
 * Tax Reports agreed: R 0). "Paid" now needs a completed payment; a tenancy
 * that has not paid yet and is not due soon is "upcoming".
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

interface Payment {
  status: string;
  due_date: string;
  paid_date?: string | null;
}

export function rentRollStatus(
  propertyStatus: string | null | undefined,
  payments: Payment[],
  today: Date = new Date()
): RentRollStatus {
  if (propertyStatus !== 'rented') return 'no_lease';
  if (payments.some((p) => p.status === 'processing')) return 'processing';
  if (payments.some((p) => p.status === 'pending' && new Date(p.due_date) < today)) {
    return 'overdue';
  }
  const next = payments
    .filter((p) => p.status === 'pending' && new Date(p.due_date) >= today)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
  if (next) {
    const daysUntilDue = Math.ceil(
      (new Date(next.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilDue <= DUE_SOON_DAYS) return 'pending';
  }
  const hasPaid = payments.some((p) => p.status === 'completed' && p.paid_date);
  if (hasPaid) return 'paid';
  return 'upcoming';
}
