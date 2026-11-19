/**
 * CT7-063: the owner dashboard's "In Arrears" amount and "Tenants In Arrears"
 * count must match the Rent Roll (summarizeRent, CT7-057). The old dashboard
 * counted every pending row whose due date was before "now" (timestamps, any
 * payment type, any lease or property) and ignored failed and partial rent.
 */
import { calculateAnalytics, calculatePortfolioStats } from '../ownerDashboardApi';
import { summarizeRent, type RentPayment } from '../../utils/rentRollStatus';

jest.mock('@/src/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/src/features/properties/api/propertiesApi', () => ({ propertiesApi: {} }));
jest.mock('@/src/features/properties/api/paymentsApi', () => ({ paymentsApi: {} }));
jest.mock('@/src/features/properties/api/applicationsApi', () => ({ applicationsApi: {} }));
jest.mock('@/src/features/maintenance/api', () => ({ getMaintenanceRequests: jest.fn() }));
jest.mock('@/src/core/observability/sentry', () => ({ reportApiError: jest.fn() }));

const active = { status: 'active' };
const properties = [
  { id: 'datura', status: 'rented', rent_amount: 5500 }, // failed rent, past due
  { id: 'dolphin', status: 'rented', rent_amount: 7000 }, // partial payment
  { id: 'dewaal', status: 'rented', rent_amount: 6000 }, // all settled; deposit + rent due today
  { id: 'old', status: 'rented', rent_amount: 4000 }, // previous tenant's unpaid rent only
  { id: 'empty', status: 'available', rent_amount: 3000 }, // not rented, stale pending row
  { id: 'paying', status: 'rented', rent_amount: 4500 }, // overdue, tenant payment processing
];

const pay = (property_id: string, tenant_id: string, p: Partial<RentPayment>) => ({
  property_id,
  tenant_id,
  amount: 5500,
  type: 'rent',
  lease: active,
  status: 'pending',
  due_date: '2026-11-01',
  ...p,
});

const payments = [
  pay('datura', 't1', { status: 'completed', due_date: '2026-10-01' }),
  pay('datura', 't1', { status: 'failed', due_date: '2026-11-01' }),
  pay('dolphin', 't2', {
    status: 'completed',
    amount: 7000,
    amount_outstanding: 4000,
    due_date: '2026-11-01',
  }),
  pay('dewaal', 't3', { status: 'completed', amount: 6000, due_date: '2026-10-19' }),
  pay('dewaal', 't3', { type: 'deposit', amount: 12000, due_date: '2026-11-01' }),
  pay('dewaal', 't3', { amount: 6000, due_date: '2026-11-19' }),
  pay('old', 't4', { amount: 4000, due_date: '2026-10-01', lease: { status: 'terminated' } }),
  pay('old', 't4', { status: 'cancelled', amount: 4000, due_date: '2026-11-01' }),
  pay('empty', 't5', { amount: 3000, due_date: '2026-10-01', lease: { status: 'terminated' } }),
  pay('paying', 't6', { amount: 4500, due_date: '2026-11-01' }),
  pay('paying', 't6', { status: 'processing', amount: 4500, due_date: '2026-11-01' }),
];

/** What the Rent Roll shows: overdue properties and their overdue amounts. */
const rentRoll = () =>
  properties
    .map((p) =>
      summarizeRent(
        p.status,
        payments.filter((x) => x.property_id === p.id),
        '2026-11-19'
      )
    )
    .filter((s) => s.status === 'overdue');

describe('owner dashboard arrears match the Rent Roll (CT7-063)', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-11-19T10:00:00Z') }));
  afterEach(() => jest.useRealTimers());

  it('"In Arrears" is the Rent Roll overdue total: failed + partial rent only', () => {
    const roll = rentRoll();
    const expected = roll.reduce((sum, s) => sum + s.overdueAmount, 0);
    expect(expected).toBe(5500 + 4000);
    expect(calculatePortfolioStats(properties, payments).arrears).toBe(expected);
  });

  it('"Tenants In Arrears" is the number of overdue tenancies on the Rent Roll', () => {
    expect(rentRoll()).toHaveLength(2);
    expect(calculateAnalytics(properties, payments, []).tenantsInArrears).toBe(2);
  });

  it('no arrears when every rent that fell due is paid', () => {
    const paid = [pay('datura', 't1', { status: 'completed', due_date: '2026-11-01' })];
    expect(calculatePortfolioStats(properties, paid).arrears).toBe(0);
    expect(calculateAnalytics(properties, paid, []).tenantsInArrears).toBe(0);
  });
});
