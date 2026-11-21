/**
 * CT7-033: back arrows used to jump to a fixed screen (dashboard / tab root)
 * instead of the previous one. One screen per role from PR #242, rendered for
 * real: pressing the header arrow goes back when there is history, and only
 * goes to the screen's fallback when there is none. The rest of the PR #242
 * screens are covered by the source scan in hooks/__tests__/useGoBackOr.test.ts.
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import OwnerRenewalsDashboardScreen from '@/src/features/owner/screens/OwnerRenewalsDashboardScreen';
import TenantPaymentDisputeScreen from '@/src/features/tenant/screens/TenantPaymentDisputeScreen';
import VendorNotificationsScreen from '@/src/features/vendor/screens/VendorNotificationsScreen';
import { supabase } from '@/src/lib/supabase';

const mockRouter = { back: jest.fn(), canGoBack: jest.fn(), navigate: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  // run focus effects like a mount effect
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
// icons render their name so the arrow can be found and pressed
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('@/src/features/leases/api/leaseExpiry.api', () => ({
  leaseExpiryApi: { getExpiringLeases: jest.fn(async () => []) },
}));
jest.mock('@/src/features/payments/api/paymentDisputes.api', () => ({
  paymentDisputesApi: { getTenantDisputes: jest.fn(() => new Promise(() => {})) },
}));
jest.mock('@/src/features/notifications/utils/unreadNotifications', () => ({
  fetchUnreadNotifications: jest.fn(async () => []),
  linkNotifications: jest.fn(() => []),
  markNotificationsRead: jest.fn(),
  notificationRoute: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

/** A supabase query builder whose every call chains and which resolves to `result`. */
function query(result: unknown) {
  const q: unknown = new Proxy(
    {},
    {
      get: (_, key) =>
        key === 'then'
          ? (ok: (v: unknown) => unknown, fail: (e: unknown) => unknown) =>
              Promise.resolve(result).then(ok, fail)
          : () => q,
    }
  );
  return q;
}

const SCREENS: [string, React.ComponentType, string][] = [
  ['owner: Lease Renewals', OwnerRenewalsDashboardScreen, '/(owner)/dashboard'],
  ['tenant: Payment Disputes', TenantPaymentDisputeScreen, '/(tenant)/payments'],
  ['vendor: Notifications', VendorNotificationsScreen, '/(vendor)/dashboard'],
];

async function pressArrow(Screen: React.ComponentType) {
  const screen = render(<Screen />);
  // let mount + focus loads settle (Renewals loads twice and re-shows its spinner)
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await waitFor(() => expect(screen.getByText('icon:arrow-back')).toBeTruthy());
  await act(async () => {
    fireEvent.press(screen.getByText('icon:arrow-back'));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'user-1' } } });
  (supabase.from as jest.Mock).mockReturnValue(query({ data: [], error: null, count: 0 }));
});

describe.each(SCREENS)('%s back arrow (CT7-033)', (_, Screen, fallback) => {
  it('returns to the previous screen when there is one', async () => {
    mockRouter.canGoBack.mockReturnValue(true);
    await pressArrow(Screen);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it(`opened cold: goes to ${fallback}`, async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    await pressArrow(Screen);
    expect(mockRouter.navigate).toHaveBeenCalledWith(fallback);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
