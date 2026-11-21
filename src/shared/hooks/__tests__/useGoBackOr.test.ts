/**
 * CT7-055: back from a maintenance request detail (a hidden tab, tabs with
 * backBehavior="history") must never lead back into the same request.
 */
import React from 'react';
import { fireEvent, render, renderHook } from '@testing-library/react-native';
import { CommonActions, TabRouter, type TabNavigationState } from '@react-navigation/routers';
import { useNavigation } from '@react-navigation/native';
import { useGoBackOr } from '../useGoBackOr';
import { ScreenHeader } from '../../components/layouts/ScreenHeader';

jest.mock('@react-navigation/native', () => ({ useNavigation: jest.fn() }));
const mockRouter = { back: jest.fn(), canGoBack: jest.fn(), navigate: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

describe('useGoBackOr (CT7-055)', () => {
  const nav = { canGoBack: jest.fn(), goBack: jest.fn(), reset: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue(nav);
  });

  it('with history: goes back, like Android Back', () => {
    nav.canGoBack.mockReturnValue(true);
    renderHook(() => useGoBackOr('maintenance')).result.current();
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(nav.reset).not.toHaveBeenCalled();
  });

  it('opened cold (no history): resets the tabs to the list', () => {
    nav.canGoBack.mockReturnValue(false);
    renderHook(() => useGoBackOr('maintenance')).result.current();
    expect(nav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'maintenance' }] });
    expect(nav.goBack).not.toHaveBeenCalled();
  });
});

describe('owner tab history with the real TabRouter (CT7-055)', () => {
  // the owner tabs, abbreviated: the detail is a hidden tab like the list
  const routeNames = ['dashboard', 'properties', 'maintenance', 'tenants', 'maintenance/[id]'];
  const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
  const router = TabRouter({ backBehavior: 'history' });
  type State = TabNavigationState<Record<string, object | undefined>>;
  const focused = (s: State | null) => (s ? s.routes[s.index].name : 'left the tabs');
  const act = (s: State, action: Parameters<typeof router.getStateForAction>[1]) =>
    router.getStateForAction(s, action, options) as State | null;

  /** Detail opened cold from a notification: the only history entry. */
  function coldDetail(): State {
    const s = act(
      router.getInitialState(options),
      CommonActions.navigate({ name: 'maintenance/[id]' })
    )!;
    return { ...s, history: s.history.slice(-1) };
  }

  it('navigating to the list keeps the detail in history, so Back reopens it (the bug)', () => {
    const list = act(coldDetail(), CommonActions.navigate({ name: 'maintenance' }))!;
    expect(focused(list)).toBe('maintenance');
    expect(focused(act(list, CommonActions.goBack()))).toBe('maintenance/[id]');
  });

  it('resetting to the list (useGoBackOr) leaves the request behind', () => {
    const list = router.getRehydratedState(
      { index: 0, routes: [{ name: 'maintenance' }], stale: true } as never,
      options
    ) as State;
    expect(focused(list)).toBe('maintenance');
    expect(focused(act(list, CommonActions.goBack()))).not.toBe('maintenance/[id]');
  });

  it('list → detail → back returns to the list, and Back from there leaves Maintenance', () => {
    const list = act(
      router.getInitialState(options),
      CommonActions.navigate({ name: 'maintenance' })
    )!;
    const detail = act(list, CommonActions.navigate({ name: 'maintenance/[id]' }))!;
    const back = act(detail, CommonActions.goBack())!;
    expect(focused(back)).toBe('maintenance');
    expect(focused(act(back, CommonActions.goBack()))).toBe('dashboard');
  });
});

describe('maintenance detail screens use useGoBackOr (CT7-055 guard)', () => {
  const fs = jest.requireActual('fs') as typeof import('fs');
  const path = jest.requireActual('path') as typeof import('path');
  const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
  const SCREENS = [
    'src/features/owner/screens/OwnerMaintenanceDetailScreen.tsx',
    'src/features/tenant/screens/TenantMaintenanceDetailScreen.tsx',
    'app/(vendor)/maintenance/[id].tsx',
  ];

  it.each(SCREENS)('%s goes back through useGoBackOr only', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    expect(src).toMatch(/useGoBackOr\('maintenance'\)/);
    expect(src).not.toMatch(/router\.back\(\)/);
    expect(src).not.toMatch(/router\.(push|replace|navigate)\(['`]\/\(\w+\)\/maintenance['`]\)/);
  });
});

/**
 * CT7-033: these back arrows used to jump to a fixed screen (dashboard, tab
 * root) instead of the previous one. They go through the shared goBack helper,
 * which only uses the fallback when there is no history. The count is every
 * back arrow in the screen. Post-submit `router.back()` calls in
 * TenantVerificationScreen and VendorQuoteSubmitScreen are not header back
 * arrows, so this checks the helper calls, not the absence of router.back().
 * One screen per role is also rendered and its arrow pressed in
 * src/shared/navigation/__tests__/backArrows.test.tsx.
 */
describe('back arrows use the shared goBack helper (CT7-033 guard)', () => {
  const fs = jest.requireActual('fs') as typeof import('fs');
  const path = jest.requireActual('path') as typeof import('path');
  const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
  const code = (rel: string) =>
    fs
      .readFileSync(path.join(ROOT, rel), 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
  const S = 'src/features';
  // [screen, fallback passed to goBack, number of back arrows]
  const SCREENS: [string, string, number][] = [
    [`${S}/owner/screens/OwnerArrearsManagementScreen.tsx`, `'/(owner)/dashboard'`, 1],
    [
      `${S}/owner/screens/OwnerPropertyMaintenanceHistoryScreen.tsx`,
      '`/(owner)/properties/${propertyId}`',
      1,
    ],
    [`${S}/owner/screens/OwnerRenewalsDashboardScreen.tsx`, `'/(owner)/dashboard'`, 1],
    [`${S}/privacy/screens/ConsentManagementScreen.tsx`, 'profilePath', 1],
    [`${S}/tenant/screens/TenantEarlyTerminationScreen.tsx`, `'/(tenant)/lease'`, 2],
    [`${S}/tenant/screens/TenantPaymentDisputeScreen.tsx`, `'/(tenant)/payments'`, 2],
    [`${S}/tenant/screens/TenantVerificationScreen.tsx`, `'/(tenant)'`, 1],
    [
      `${S}/vendor/screens/VendorNotificationsScreen.tsx`,
      `from === 'profile' ? '/(vendor)/profile' : '/(vendor)/dashboard'`,
      1,
    ],
    [`${S}/vendor/screens/VendorQuoteSubmitScreen.tsx`, '`/(vendor)/maintenance/${id}`', 1],
  ];

  // Named handlers must also be wired to the control that calls them.
  const WIRING: Record<string, RegExp> = {
    [`${S}/tenant/screens/TenantVerificationScreen.tsx`]:
      /const handleGoBack = \(\) => goBack\(router, '\/\(tenant\)'\);[\s\S]*onRetry=\{handleGoBack\}/,
    [`${S}/vendor/screens/VendorNotificationsScreen.tsx`]:
      /const handleBack = \(\) => \{\s*goBack\(router, [^;]+\);\s*\};[\s\S]*onPress=\{handleBack\}/,
  };
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  it.each(SCREENS)('%s goes back through goBack(router, %s)', (rel, fallback, arrows) => {
    const src = code(rel);
    expect(src).toMatch(/import \{ goBack \} from '@\/src\/shared\/navigation\/goBack';/);
    // only calls that run: the whole body of an arrow (`=> goBack(…)`) or a
    // statement of its own (after `{` or `;`), so `() => false && goBack(…)`
    // or `if (false) goBack(…)` don't count
    const executed = new RegExp(`(?:=>|[{;])\\s*goBack\\(router, ${escape(fallback)}\\)`, 'g');
    expect(src.match(executed) ?? []).toHaveLength(arrows);
    if (WIRING[rel]) expect(src).toMatch(WIRING[rel]);
  });
});

describe('ScreenHeader back arrow (CT7-033)', () => {
  // the header used to call router.back() directly, which no-ops (or leaves
  // the app) when the screen was opened cold from a notification
  const router = mockRouter;
  const pressBack = () =>
    fireEvent.press(
      render(
        React.createElement(ScreenHeader, { title: 'Arrears', backFallback: '/(owner)/dashboard' })
      ).getByLabelText('Go back')
    );

  beforeEach(() => jest.clearAllMocks());

  it('with history: returns to the previous screen', () => {
    router.canGoBack.mockReturnValue(true);
    pressBack();
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('opened cold: goes to the backFallback screen', () => {
    router.canGoBack.mockReturnValue(false);
    pressBack();
    expect(router.navigate).toHaveBeenCalledWith('/(owner)/dashboard');
    expect(router.back).not.toHaveBeenCalled();
  });
});
