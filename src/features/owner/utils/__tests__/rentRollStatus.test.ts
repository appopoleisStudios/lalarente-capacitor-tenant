/**
 * CT7-057: the rent roll showed "Paid" for a new tenancy that had never paid
 * (2B Datura: first rent pending, due 1 Dec; Invoices and Tax Reports R 0).
 */
import { RENT_ROLL_STATUS_LABEL, rentRollStatus } from '../rentRollStatus';

const TODAY = new Date('2026-11-19T10:00:00Z');
const pending = (due: string) => ({ status: 'pending', due_date: due });
const paid = (due: string, on: string) => ({ status: 'completed', due_date: due, paid_date: on });

describe('rentRollStatus (CT7-057)', () => {
  it('new tenancy, first rent not due yet, nothing paid → upcoming (was "paid")', () => {
    expect(rentRollStatus('rented', [pending('2026-12-01')], TODAY)).toBe('upcoming');
  });

  it('rented with no payments at all → upcoming, never paid', () => {
    expect(rentRollStatus('rented', [], TODAY)).toBe('upcoming');
  });

  it('paid last month, next rent not due soon → paid', () => {
    expect(
      rentRollStatus('rented', [paid('2026-11-01', '2026-10-30'), pending('2026-12-01')], TODAY)
    ).toBe('paid');
  });

  it('next rent within five days → due soon', () => {
    expect(rentRollStatus('rented', [pending('2026-11-22')], TODAY)).toBe('pending');
  });

  it('a pending payment past its due date → overdue', () => {
    expect(rentRollStatus('rented', [pending('2026-11-01')], TODAY)).toBe('overdue');
  });

  it('a tenant-submitted payment awaiting confirmation → processing', () => {
    expect(
      rentRollStatus('rented', [{ status: 'processing', due_date: '2026-11-01' }], TODAY)
    ).toBe('processing');
  });

  it('cancelled payments are ignored', () => {
    expect(rentRollStatus('rented', [{ status: 'cancelled', due_date: '2026-11-01' }], TODAY)).toBe(
      'upcoming'
    );
  });

  it('not rented → no lease', () => {
    expect(rentRollStatus('available', [paid('2026-11-01', '2026-10-30')], TODAY)).toBe('no_lease');
  });

  it('badge labels are words, not raw enum values', () => {
    expect(RENT_ROLL_STATUS_LABEL.no_lease).toBe('No lease');
    expect(Object.values(RENT_ROLL_STATUS_LABEL).every((l) => !l.includes('_'))).toBe(true);
  });
});

describe('the rent roll screen uses it (CT7-057 guard)', () => {
  const fs = jest.requireActual('fs') as typeof import('fs');
  const path = jest.requireActual('path') as typeof import('path');
  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'screens', 'OwnerRentRollScreen.tsx'),
    'utf8'
  );

  it('status comes from rentRollStatus, not inline rules', () => {
    expect(src).toMatch(/rentRollStatus\(property\.status, propertyPayments, today\)/);
    expect(src).not.toMatch(/daysUntilDue <= 5 \? 'pending' : 'paid'/);
  });

  it('the badge shows a label, not the raw status', () => {
    expect(src).toMatch(/RENT_ROLL_STATUS_LABEL\[item\.payment_status\]/);
    expect(src).not.toMatch(/\{item\.payment_status\}/);
  });
});
