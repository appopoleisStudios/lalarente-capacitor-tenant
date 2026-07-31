/**
 * Centralized role → dashboard route mapping.
 *
 * Single source of truth for post-login / post-register navigation so a future
 * role (e.g. 'superuser') can't silently strand users on the login screen the
 * way 'admin' did before (see git log 3361537).
 */
export type AppUserRole = 'owner' | 'tenant' | 'vendor' | 'admin';

/**
 * Returns the dashboard route for a profile role.
 *
 * - 'admin' is the landlord/platform-owner role — lands on the owner dashboard.
 * - Unknown/null roles return '/auth/login' (defensive fallback so the user is
 *   never stranded on a dead screen).
 */
export function getDashboardRouteForRole(
  role: AppUserRole | null | undefined
): '/auth/login' | '/(owner)/dashboard' | '/(tenant)/dashboard' | '/(vendor)/dashboard' {
  switch (role) {
    case 'owner':
    case 'admin':
      return '/(owner)/dashboard';
    case 'tenant':
      return '/(tenant)/dashboard';
    case 'vendor':
      return '/(vendor)/dashboard';
    default:
      // Defensive: never leave the user stuck. Route to login so they can
      // retry; an unexpected role is a data/setup problem, not a UI state.
      console.warn(`[roleRoutes] Unrecognized role "${String(role)}" — routing to login`);
      return '/auth/login';
  }
}
