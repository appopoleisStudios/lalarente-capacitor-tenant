/**
 * CT7-033: back arrows used to jump to a fixed screen (dashboard / tab root)
 * instead of the previous one. Every back control on the screens PR #242
 * changed is rendered for real, in each state that shows one (loading, empty,
 * error, loaded), and pressed twice: with history it must go back, opened cold
 * (no history) it must go to that screen's fallback. The test also pins how
 * many back controls each state has, so one cannot silently disappear.
 * The source scan in hooks/__tests__/useGoBackOr.test.ts is an extra check.
 */
import React from 'react';
import { act, fireEvent, render, waitFor, type RenderResult } from '@testing-library/react-native';
import OwnerArrearsManagementScreen from '@/src/features/owner/screens/OwnerArrearsManagementScreen';
import OwnerPropertyMaintenanceHistoryScreen from '@/src/features/owner/screens/OwnerPropertyMaintenanceHistoryScreen';
import OwnerRenewalsDashboardScreen from '@/src/features/owner/screens/OwnerRenewalsDashboardScreen';
import ConsentManagementScreen from '@/src/features/privacy/screens/ConsentManagementScreen';
import TenantEarlyTerminationScreen from '@/src/features/tenant/screens/TenantEarlyTerminationScreen';
import TenantPaymentDisputeScreen from '@/src/features/tenant/screens/TenantPaymentDisputeScreen';
import TenantVerificationScreen from '@/src/features/tenant/screens/TenantVerificationScreen';
import VendorNotificationsScreen from '@/src/features/vendor/screens/VendorNotificationsScreen';
import VendorQuoteSubmitScreen from '@/src/features/vendor/screens/VendorQuoteSubmitScreen';
import { supabase } from '@/src/lib/supabase';
import { arrearsEscalationApi } from '@/src/features/payments/api/arrearsEscalation.api';
import { paymentDisputesApi } from '@/src/features/payments/api/paymentDisputes.api';
import { leaseExpiryApi } from '@/src/features/leases/api/leaseExpiry.api';
import { leaseTerminationApi } from '@/src/features/leases/api/leaseTermination.api';
import { consentApi } from '@/src/features/privacy/api';
import { getVendorRequestById } from '@/src/features/maintenance/api';
import { useMaintenanceRequests } from '@/src/features/maintenance/hooks';

const mockRouter = { back: jest.fn(), canGoBack: jest.fn(), navigate: jest.fn(), push: jest.fn() };
const mockParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  useSegments: () => ['(tenant)'],
  // run focus effects like a mount effect
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
// icons render their name so the arrows can be found and pressed
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('@/src/features/payments/api/arrearsEscalation.api', () => ({
  arrearsEscalationApi: { getOwnerEscalations: jest.fn() },
}));
jest.mock('@/src/features/payments/api/paymentDisputes.api', () => ({
  paymentDisputesApi: { getOwnerArrangements: jest.fn(), getUserDisputes: jest.fn() },
}));
jest.mock('@/src/features/leases/api/leaseExpiry.api', () => ({
  leaseExpiryApi: { getExpiringLeases: jest.fn() },
}));
jest.mock('@/src/features/leases/api/leaseTermination.api', () => ({
  leaseTerminationApi: { calculateTerminationPenalty: jest.fn() },
}));
jest.mock('@/src/features/privacy/api', () => ({
  consentApi: { getActiveConsents: jest.fn() },
  OPTIONAL_CONSENTS: [],
}));
jest.mock('@/src/features/maintenance/api', () => ({ getVendorRequestById: jest.fn() }));
jest.mock('@/src/features/maintenance/hooks', () => ({ useMaintenanceRequests: jest.fn() }));
jest.mock('@/src/features/notifications/utils/unreadNotifications', () => ({
  fetchUnreadNotifications: jest.fn(async () => []),
  linkNotifications: jest.fn(() => []),
  markNotificationsRead: jest.fn(),
  notificationRoute: jest.fn(),
}));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: {} }));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
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
const never = () => new Promise(() => {});
const maintenance = (state: object) =>
  (useMaintenanceRequests as jest.Mock).mockReturnValue({
    requests: [],
    loading: false,
    error: null,
    refreshing: false,
    onRefresh: jest.fn(),
    refetch: jest.fn(),
    ...state,
  });

const arrows = (s: RenderResult) => s.queryAllByText('icon:arrow-back');

interface Case {
  screen: React.ComponentType;
  /** stubs the data for this state */
  setup: () => void;
  /** text only this state shows, so the right variant is under test */
  marker: string;
  /** text this state must not show (it would mean another variant rendered) */
  absent?: string;
  find: (s: RenderResult) => ReturnType<RenderResult['getByText']>[];
  count: number;
  fallback: string;
}

const CASES: Record<string, Case> = {
  'owner Arrears (loaded)': {
    screen: OwnerArrearsManagementScreen,
    setup: () => {
      (arrearsEscalationApi.getOwnerEscalations as jest.Mock).mockResolvedValue(null);
      (paymentDisputesApi.getOwnerArrangements as jest.Mock).mockResolvedValue([]);
    },
    marker: 'Arrears Management',
    find: arrows,
    count: 1,
    fallback: '/(owner)/dashboard',
  },
  'owner Maintenance History (loading)': {
    screen: OwnerPropertyMaintenanceHistoryScreen,
    setup: () => maintenance({ loading: true }),
    marker: 'Loading requests...',
    find: (s) => s.queryAllByTestId('owner-maintenance-history-back'),
    count: 1,
    fallback: '/(owner)/properties/prop-1',
  },
  'owner Maintenance History (error)': {
    screen: OwnerPropertyMaintenanceHistoryScreen,
    setup: () => maintenance({ error: 'offline' }),
    marker: 'Failed to load requests',
    find: (s) => s.queryAllByTestId('owner-maintenance-history-back'),
    count: 1,
    fallback: '/(owner)/properties/prop-1',
  },
  'owner Maintenance History (loaded)': {
    screen: OwnerPropertyMaintenanceHistoryScreen,
    setup: () => maintenance({}),
    marker: '0 requests for this property',
    find: (s) => s.queryAllByTestId('owner-maintenance-history-back'),
    count: 1,
    fallback: '/(owner)/properties/prop-1',
  },
  'owner Lease Renewals (loaded)': {
    screen: OwnerRenewalsDashboardScreen,
    setup: () => (leaseExpiryApi.getExpiringLeases as jest.Mock).mockResolvedValue([]),
    marker: 'Lease Renewals',
    find: arrows,
    count: 1,
    fallback: '/(owner)/dashboard',
  },
  'tenant Privacy & Consent (loaded)': {
    screen: ConsentManagementScreen,
    setup: () => (consentApi.getActiveConsents as jest.Mock).mockResolvedValue([]),
    marker: 'Privacy & Consent',
    find: arrows,
    count: 1,
    fallback: '/(tenant)/profile',
  },
  'tenant Early Termination (no estimate)': {
    screen: TenantEarlyTerminationScreen,
    setup: () =>
      (leaseTerminationApi.calculateTerminationPenalty as jest.Mock).mockRejectedValue(
        new Error('no lease')
      ),
    marker: 'Unable to calculate termination estimate',
    find: arrows,
    count: 1,
    fallback: '/(tenant)/lease',
  },
  'tenant Early Termination (loaded)': {
    screen: TenantEarlyTerminationScreen,
    setup: () =>
      (leaseTerminationApi.calculateTerminationPenalty as jest.Mock).mockResolvedValue({
        leaseId: 'lease-1',
        monthlyRent: 8500,
        remainingMonths: 6,
        penaltyAmount: 17000,
        noticePeriodDays: 20,
        effectiveDate: '2030-01-31',
        depositRefundEstimate: 0,
      }),
    marker: 'Early Termination',
    absent: 'Unable to calculate termination estimate',
    find: arrows,
    count: 1,
    fallback: '/(tenant)/lease',
  },
  'tenant Payment Disputes (loading)': {
    screen: TenantPaymentDisputeScreen,
    setup: () => (paymentDisputesApi.getUserDisputes as jest.Mock).mockImplementation(never),
    marker: 'Payment Disputes',
    absent: 'icon:add-circle-outline',
    find: arrows,
    count: 1,
    fallback: '/(tenant)/payments',
  },
  'tenant Payment Disputes (loaded)': {
    screen: TenantPaymentDisputeScreen,
    setup: () => (paymentDisputesApi.getUserDisputes as jest.Mock).mockResolvedValue([]),
    marker: 'icon:add-circle-outline',
    find: arrows,
    count: 1,
    fallback: '/(tenant)/payments',
  },
  'tenant Verify Work (link incomplete)': {
    screen: TenantVerificationScreen,
    setup: () => undefined,
    marker: 'Verification link incomplete',
    find: (s) => s.queryAllByText('Go Back'),
    count: 1,
    fallback: '/(tenant)',
  },
  'vendor Notifications (from dashboard)': {
    screen: VendorNotificationsScreen,
    setup: () => undefined,
    marker: 'Notifications',
    find: arrows,
    count: 1,
    fallback: '/(vendor)/dashboard',
  },
  'vendor Notifications (from profile)': {
    screen: VendorNotificationsScreen,
    setup: () => (mockParams.from = 'profile'),
    marker: 'Notifications',
    find: arrows,
    count: 1,
    fallback: '/(vendor)/profile',
  },
  'vendor Submit Quote (loaded)': {
    screen: VendorQuoteSubmitScreen,
    setup: () => {
      mockParams.id = 'req-1';
      (getVendorRequestById as jest.Mock).mockResolvedValue({
        id: 'req-1',
        can_quote: true,
        my_quote: null,
      });
    },
    marker: 'icon:arrow-back',
    find: (s) => s.queryAllByTestId('quote-back'),
    count: 1,
    fallback: '/(vendor)/maintenance/req-1',
  },
};

async function renderCase(c: Case) {
  c.setup();
  const s = render(<c.screen />);
  // let the mount / focus loads settle (some screens load twice)
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await waitFor(() => expect(s.getAllByText(c.marker).length).toBeGreaterThan(0));
  if (c.absent) expect(s.queryByText(c.absent)).toBeNull();
  return s;
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockParams)) delete mockParams[k];
  mockParams.propertyId = 'prop-1';
  mockParams.leaseId = 'lease-1';
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'user-1' } } });
  (supabase.from as jest.Mock).mockReturnValue(query({ data: [], error: null, count: 0 }));
});

describe.each(Object.entries(CASES))('%s (CT7-033)', (_, c) => {
  it(`has ${c.count} back control(s)`, async () => {
    expect(c.find(await renderCase(c))).toHaveLength(c.count);
  });

  it.each(Array.from({ length: c.count }, (__, i) => i))(
    'back control #%i: with history it returns to the previous screen',
    async (i) => {
      mockRouter.canGoBack.mockReturnValue(true);
      const s = await renderCase(c);
      await act(async () => {
        fireEvent.press(c.find(s)[i]);
      });
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    }
  );

  it.each(Array.from({ length: c.count }, (__, i) => i))(
    `back control #%i: opened cold it goes to ${c.fallback}`,
    async (i) => {
      mockRouter.canGoBack.mockReturnValue(false);
      const s = await renderCase(c);
      await act(async () => {
        fireEvent.press(c.find(s)[i]);
      });
      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith(c.fallback);
      expect(mockRouter.back).not.toHaveBeenCalled();
    }
  );
});

// The Approve / Needs-fixes steps of Verify Work have their own arrows; they
// step back to the first step inside the screen and must not navigate away.
describe.each([
  ['tenant-verify-satisfactory', 'tenant-verify-approve-back'],
  ['tenant-verify-needs-fixes', 'tenant-verify-reject-back'],
])('tenant Verify Work step %s (CT7-033)', (open, back) => {
  it('its arrow returns to the first step without leaving the screen', async () => {
    mockParams.requestId = 'req-1';
    const s = render(<TenantVerificationScreen />);
    fireEvent.press(await waitFor(() => s.getByTestId(open)));
    fireEvent.press(s.getByTestId(back));
    expect(s.getByTestId('tenant-verify-title')).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
});
