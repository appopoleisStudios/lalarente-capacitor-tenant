/**
 * Tenant dashboard, rendered with the real screen and a stubbed data hook.
 * CT7-026: while the first data loads it shows the skeleton, not a spinner.
 * CT7-013: the "Complete Your Profile" banner lists exactly the fields the
 * shared check reports missing, goes away once nothing is missing, and its
 * button opens Profile (it used to show a mislabelled "References" row and
 * route to Documents).
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import TenantDashboardScreen from '../TenantDashboardScreen';
import { useTenantDashboard } from '../../hooks/useTenantDashboard';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useFocusEffect: jest.fn() }));
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'tenant-1' } }) }));
jest.mock('../../hooks/useTenantDashboard', () => ({
  useTenantDashboard: jest.fn(),
  useTenantDashboardQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const hook = useTenantDashboard as jest.Mock;
const loaded = (data: object) => ({
  data: { userName: 'Nashin', ...data },
  isLoading: false,
  isError: false,
  isRefetching: false,
  refetch: jest.fn(),
});

beforeEach(() => jest.clearAllMocks());

it('shows the dashboard skeleton while loading (CT7-026)', () => {
  hook.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: jest.fn() });
  const screen = render(<TenantDashboardScreen />);
  expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
  expect(screen.getByText('Welcome back,')).toBeTruthy();
});

describe('Complete Your Profile banner (CT7-013)', () => {
  it('lists the missing fields and opens Profile', () => {
    hook.mockReturnValue(loaded({ profileMissing: ['Phone number', 'Proof of address'] }));
    const screen = render(<TenantDashboardScreen />);
    expect(screen.getByText('Complete Your Profile')).toBeTruthy();
    expect(screen.getByText('Phone number')).toBeTruthy();
    expect(screen.getByText('Proof of address')).toBeTruthy();
    expect(screen.queryByText('References')).toBeNull();
    fireEvent.press(screen.getByText('Complete Profile'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(tenant)/profile');
  });

  it('is gone once nothing is missing', () => {
    hook.mockReturnValue(loaded({ profileMissing: [] }));
    expect(render(<TenantDashboardScreen />).queryByText('Complete Your Profile')).toBeNull();
  });

  it('is not shown before the check has answered (or when it failed)', () => {
    hook.mockReturnValue(loaded({ profileMissing: undefined }));
    expect(render(<TenantDashboardScreen />).queryByText('Complete Your Profile')).toBeNull();
  });
});
