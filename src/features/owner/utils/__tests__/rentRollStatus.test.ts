/**
 * CT7-057: the rent roll showed "Paid" for a new tenancy that had never paid
 * (2B Datura: first rent pending, due 1 Dec; Invoices and Tax Reports R 0).
 * SA #262 cases: partial and failed payments, a previous tenant's payments,
 * calendar-date comparison in SAST.
 */
import {
  RENT_ROLL_STATUS_LABEL,
  saToday,
  summarizeRent,
  type RentPayment,
} from '../rentRollStatus';

const TODAY = '2026-11-19';
const active = { status: 'active' };
const old = { status: 'terminated' };
const row = (p: Partial<RentPayment> & { due_date: string; status: string }): RentPayment => ({
  amount: 5500,
  type: 'rent',
  lease: active,
  ...p,
});
const status = (payments: RentPayment[], today = TODAY, property = 'rented') =>
  summarizeRent(property, payments, today).status;

describe('summarizeRent (CT7-057)', () => {
  it('new tenancy, first rent pending next month, nothing paid → upcoming (was "paid")', () => {
    expect(status([row({ status: 'pending', due_date: '2026-12-01' })])).toBe('upcoming');
  });

  it('rented with no payments at all → upcoming', () => {
    expect(status([])).toBe('upcoming');
  });

  it('latest rent that fell due is paid, next not due soon → paid', () => {
    expect(
      status([
        row({ status: 'completed', due_date: '2026-11-01' }),
        row({ status: 'pending', due_date: '2026-12-01' }),
      ])
    ).toBe('paid');
  });

  it('next unpaid rent within five days → due soon', () => {
    expect(status([row({ status: 'pending', due_date: '2026-11-24' })])).toBe('pending');
    expect(status([row({ status: 'pending', due_date: '2026-11-25' })])).toBe('upcoming');
  });

  it('pending past its due date → overdue, with the amount', () => {
    const s = summarizeRent('rented', [row({ status: 'pending', due_date: '2026-11-01' })], TODAY);
    expect(s).toMatchObject({ status: 'overdue', overdueAmount: 5500 });
  });

  it('a failed payment is unpaid: overdue once due (SA: was upcoming or paid)', () => {
    expect(
      status([
        row({ status: 'completed', due_date: '2026-10-01' }),
        row({ status: 'failed', due_date: '2026-11-01' }),
      ])
    ).toBe('overdue');
  });

  it('a partial payment is unpaid: overdue for the outstanding amount (SA: was paid)', () => {
    const s = summarizeRent(
      'rented',
      [row({ status: 'completed', due_date: '2026-11-01', amount_outstanding: 4000 })],
      TODAY
    );
    expect(s).toMatchObject({ status: 'overdue', overdueAmount: 4000 });
  });

  it("a previous tenant's paid rent does not make a new tenancy paid", () => {
    expect(
      status([
        row({ status: 'completed', due_date: '2026-10-01', lease: old }),
        row({ status: 'pending', due_date: '2026-12-01' }),
      ])
    ).toBe('upcoming');
  });

  it('only a terminated lease has rows: neither paid nor overdue for the new tenancy', () => {
    expect(status([row({ status: 'completed', due_date: '2026-10-01', lease: old })])).toBe(
      'upcoming'
    );
    const s = summarizeRent(
      'rented',
      [row({ status: 'pending', due_date: '2026-10-01', lease: old })],
      TODAY
    );
    expect(s).toMatchObject({ status: 'upcoming', overdueAmount: 0, nextDue: null });
  });

  it('rent due today is not overdue yet; it is due soon', () => {
    expect(status([row({ status: 'pending', due_date: TODAY })])).toBe('pending');
  });

  it('"today" is the South African calendar date', () => {
    expect(saToday(new Date('2026-11-18T22:30:00Z'))).toBe('2026-11-19'); // 00:30 SAST
    expect(saToday(new Date('2026-11-19T21:59:00Z'))).toBe('2026-11-19'); // 23:59 SAST
  });

  it('processing beats everything; cancelled and non-rent rows are ignored', () => {
    expect(
      status([
        row({ status: 'processing', due_date: '2026-11-01' }),
        row({ status: 'pending', due_date: '2026-11-01' }),
      ])
    ).toBe('processing');
    expect(
      status([
        row({ status: 'cancelled', due_date: '2026-11-01' }),
        row({ status: 'pending', due_date: '2026-11-01', type: 'deposit' }),
      ])
    ).toBe('upcoming');
  });

  it('not rented → no lease', () => {
    expect(status([row({ status: 'completed', due_date: '2026-11-01' })], TODAY, 'available')).toBe(
      'no_lease'
    );
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

  it('status, next due and overdue amount come from summarizeRent', () => {
    expect(src).toMatch(/summarizeRent\(\s*property\.status/);
    expect(src).toMatch(/payment_status: rent\.status/);
    expect(src).toMatch(/overdue_amount: rent\.overdueAmount/);
    expect(src).not.toMatch(/daysUntilDue <= 5 \? 'pending' : 'paid'/);
  });

  it('the badge shows a label, and the chips scroll sideways', () => {
    expect(src).toMatch(/RENT_ROLL_STATUS_LABEL\[item\.payment_status\]/);
    expect(src).not.toMatch(/\{item\.payment_status\}/);
    expect(src).toMatch(/<ScrollView\s+horizontal/);
  });
});
