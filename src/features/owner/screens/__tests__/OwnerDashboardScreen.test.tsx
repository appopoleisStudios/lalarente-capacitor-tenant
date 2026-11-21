/**
 * CT7-026: after sign-in the owner dashboard showed a full-screen
 * "Loading dashboard..." spinner; it must paint the skeleton layout instead.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';
import OwnerDashboardScreen from '../OwnerDashboardScreen';
import { supabase } from '@/src/lib/supabase';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useFocusEffect: jest.fn(),
}));
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner-1' } }) }));
jest.mock('../../hooks/useOwnerDashboard', () => ({
  useOwnerDashboard: () => ({ data: null, loading: true, error: null, refetch: jest.fn() }),
}));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: {} }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

it('shows the dashboard skeleton while loading (CT7-026)', async () => {
  // no session yet: the screen's own side loads stop early
  (supabase.auth as unknown as { getSession: jest.Mock }).getSession = jest.fn(async () => ({
    data: { session: null },
  }));
  const screen = render(<OwnerDashboardScreen />);
  await act(async () => {});
  expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
  expect(screen.getByText('Portfolio Dashboard')).toBeTruthy();
  expect(screen.queryByText(/Loading dashboard/)).toBeNull();
});
