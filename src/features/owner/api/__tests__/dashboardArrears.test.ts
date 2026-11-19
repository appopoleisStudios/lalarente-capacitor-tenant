/**
 * CT7-063: the owner dashboard's "In Arrears" amount and "Tenants In Arrears"
 * count must match the Rent Roll (summarizeRent, CT7-057). The old dashboard
 * counted every pending row whose due date was before "now" (timestamps, any
 * payment type, any lease or property) and ignored failed and partial rent.
 */
import { calculateAnalytics, calculatePortfolioStats } from '../ownerDashboardApi';
import { summarizeRent } from '../../utils/rentRollStatus';
import {
  ARREARS_NOW,
  ARREARS_TODAY,
  arrearsPay,
  arrearsPayments,
  arrearsProperties,
} from './arrearsFixture';

jest.mock('@/src/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/src/features/properties/api/propertiesApi', () => ({ propertiesApi: {} }));
jest.mock('@/src/features/properties/api/paymentsApi', () => ({ paymentsApi: {} }));
jest.mock('@/src/features/properties/api/applicationsApi', () => ({ applicationsApi: {} }));
jest.mock('@/src/features/maintenance/api', () => ({ getMaintenanceRequests: jest.fn() }));
jest.mock('@/src/core/observability/sentry', () => ({ reportApiError: jest.fn() }));

const properties = arrearsProperties;
const payments = arrearsPayments;
const pay = arrearsPay;

/** What the Rent Roll shows: overdue properties and their overdue amounts. */
const rentRoll = () =>
  properties
    .map((p) =>
      summarizeRent(
        p.status,
        payments.filter((x) => x.property_id === p.id),
        ARREARS_TODAY
      )
    )
    .filter((s) => s.status === 'overdue');

describe('owner dashboard arrears match the Rent Roll (CT7-063)', () => {
  beforeEach(() => jest.useFakeTimers({ now: ARREARS_NOW }));
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
