/**
 * CT7-055: back from a maintenance request detail (a hidden tab, tabs with
 * backBehavior="history") must never lead back into the same request.
 */
import { renderHook } from '@testing-library/react-native';
import { CommonActions, TabRouter, type TabNavigationState } from '@react-navigation/routers';
import { useNavigation } from '@react-navigation/native';
import { useGoBackOr } from '../useGoBackOr';

jest.mock('@react-navigation/native', () => ({ useNavigation: jest.fn() }));

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
