import { getDashboardRouteForRole, AppUserRole } from '../roleRoutes';

describe('getDashboardRouteForRole', () => {
  it('routes owner to the owner dashboard', () => {
    expect(getDashboardRouteForRole('owner')).toBe('/(owner)/dashboard');
  });

  it('routes admin (landlord/platform owner) to the owner dashboard', () => {
    // Regression guard: admin users were previously stranded on the login
    // screen because the redirect only handled owner/tenant/vendor.
    expect(getDashboardRouteForRole('admin')).toBe('/(owner)/dashboard');
  });

  it('routes tenant to the tenant dashboard', () => {
    expect(getDashboardRouteForRole('tenant')).toBe('/(tenant)/dashboard');
  });

  it('routes vendor to the vendor dashboard', () => {
    expect(getDashboardRouteForRole('vendor')).toBe('/(vendor)/dashboard');
  });

  it('falls back to login for unknown roles (simulated DB drift)', () => {
    // Cast simulates a DB row with a role not in the enum — the runtime
    // fallback must route to login rather than strand the user.
    expect(getDashboardRouteForRole('superuser' as unknown as AppUserRole)).toBe('/auth/login');
  });

  it('falls back to login for null/undefined role', () => {
    expect(getDashboardRouteForRole(null)).toBe('/auth/login');
    expect(getDashboardRouteForRole(undefined)).toBe('/auth/login');
  });
});
