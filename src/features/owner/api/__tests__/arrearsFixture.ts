/**
 * CT7-063 fixture shared by the dashboard and Rent Roll arrears tests.
 * Today is 2026-11-19 (SAST). The Rent Roll shows two tenancies overdue:
 * datura (failed rent, R 5 500) and dolphin (partial payment, R 4 000 left).
 */
import type { RentPayment } from '../../utils/rentRollStatus';

export const ARREARS_NOW = new Date('2026-11-19T10:00:00Z');
export const ARREARS_TODAY = '2026-11-19';

const active = { status: 'active' };

export const arrearsProperties = [
  { id: 'datura', title: '2B Datura', status: 'rented', rent_amount: 5500 }, // failed rent, past due
  { id: 'dolphin', title: 'Dolphin', status: 'rented', rent_amount: 7000 }, // partial payment
  { id: 'dewaal', title: '96 De Waal', status: 'rented', rent_amount: 6000 }, // settled; deposit + rent due today
  { id: 'old', title: 'Old Tenancy', status: 'rented', rent_amount: 4000 }, // previous tenant's unpaid rent only
  { id: 'empty', title: 'Vacant', status: 'available', rent_amount: 3000 }, // not rented, stale pending row
  { id: 'paying', title: 'Paying', status: 'rented', rent_amount: 4500 }, // overdue, tenant payment processing
];

let seq = 0;
export const arrearsPay = (property_id: string, tenant_id: string, p: Partial<RentPayment>) => ({
  id: `pay-${++seq}`,
  property_id,
  tenant_id,
  amount: 5500,
  type: 'rent',
  lease: active,
  status: 'pending',
  due_date: '2026-11-01',
  paid_date: null as string | null,
  ...p,
});

export const arrearsPayments = [
  arrearsPay('datura', 't1', { status: 'completed', due_date: '2026-10-01' }),
  arrearsPay('datura', 't1', { status: 'failed', due_date: '2026-11-01' }),
  arrearsPay('dolphin', 't2', {
    status: 'completed',
    amount: 7000,
    amount_outstanding: 4000,
    due_date: '2026-11-01',
  }),
  arrearsPay('dewaal', 't3', { status: 'completed', amount: 6000, due_date: '2026-10-19' }),
  arrearsPay('dewaal', 't3', { type: 'deposit', amount: 12000, due_date: '2026-11-01' }),
  arrearsPay('dewaal', 't3', { amount: 6000, due_date: '2026-11-19' }),
  arrearsPay('old', 't4', {
    amount: 4000,
    due_date: '2026-10-01',
    lease: { status: 'terminated' },
  }),
  arrearsPay('old', 't4', { status: 'cancelled', amount: 4000, due_date: '2026-11-01' }),
  arrearsPay('empty', 't5', {
    amount: 3000,
    due_date: '2026-10-01',
    lease: { status: 'terminated' },
  }),
  arrearsPay('paying', 't6', { amount: 4500, due_date: '2026-11-01' }),
  arrearsPay('paying', 't6', { status: 'processing', amount: 4500, due_date: '2026-11-01' }),
];
