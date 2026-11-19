/**
 * CT7-056 (SA #261): every Recent Activity item links to its own record —
 * record ids, never the related property's id.
 */
import { buildActivityFeed } from '../ownerDashboardApi';

jest.mock('@/src/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/src/features/properties/api/propertiesApi', () => ({ propertiesApi: {} }));
jest.mock('@/src/features/properties/api/paymentsApi', () => ({ paymentsApi: {} }));
jest.mock('@/src/features/properties/api/applicationsApi', () => ({ applicationsApi: {} }));
jest.mock('@/src/features/maintenance/api', () => ({ getMaintenanceRequests: jest.fn() }));
jest.mock('@/src/core/observability/sentry', () => ({ reportApiError: jest.fn() }));

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const property = { id: 'prop-9', title: '2B Datura' };

describe('buildActivityFeed routes (CT7-056)', () => {
  const feed = buildActivityFeed(
    [
      {
        id: 'pay-1',
        status: 'completed',
        amount: 5500,
        paid_date: hoursAgo(1),
        property_id: 'prop-9',
      },
      {
        id: 'pay-2',
        status: 'overdue',
        amount: 5500,
        due_date: hoursAgo(30),
        property_id: 'prop-9',
      },
    ],
    [{ id: 'req-1', status: 'open', created_at: hoursAgo(2), property_id: 'prop-9', property }],
    [{ id: 'app-1', created_at: hoursAgo(3), property_id: 'prop-9', property }],
    [
      {
        id: 'view-1',
        status: 'cancelled',
        created_at: hoursAgo(4),
        updated_at: hoursAgo(4),
        property,
        tenant: { full_name: 'Nashin' },
      },
    ]
  );
  const routeOf = (label: string) => feed.find((a) => a.label === label)?.route;

  it('rent received → Rent Roll', () =>
    expect(routeOf('Rent Received')).toBe('/(owner)/rent-roll'));
  it('arrears notice → Arrears', () => expect(routeOf('Arrears Notice')).toBe('/(owner)/arrears'));
  it('new maintenance → that request', () =>
    expect(routeOf('New Maintenance')).toBe('/(owner)/maintenance/req-1'));
  it('new application → that application', () =>
    expect(routeOf('New Application')).toBe('/(owner)/applications/app-1'));
  it('viewing event → that viewing', () =>
    expect(routeOf('Viewing Cancelled')).toBe('/(owner)/viewings/view-1'));
  it('every item has a route', () => expect(feed.every((a) => a.route)).toBe(true));
});
