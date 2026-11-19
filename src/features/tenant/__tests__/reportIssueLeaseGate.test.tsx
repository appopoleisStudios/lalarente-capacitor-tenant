/**
 * CT7-066 regression: Report Issue is between owner and tenant, so it exists
 * only when the tenant's lease is signed by both and in effect. A lease still
 * awaiting a signature must not expose the Report Issue entry point, and the
 * report screen (reachable by deep link) must refuse instead of showing the
 * form.
 */
import React, { useEffect as mockUseEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import TenantMaintenanceReportScreen from '../screens/TenantMaintenanceReportScreen';
import TenantMaintenanceListScreen from '../screens/TenantMaintenanceListScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void) => mockUseEffect(cb, [cb]),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'tenant-1' } }) }));
jest.mock('@/src/features/inspections/api/inspectionsApi', () => ({ inspectionsApi: {} }));
jest.mock('@/src/features/messaging/api/messagesApi', () => ({ messagesApi: {} }));
jest.mock('@/src/features/maintenance/api', () => ({
  maintenanceApi: {
    getServiceCategories: jest.fn(() => Promise.resolve([])),
    getPropertyServiceItems: jest.fn(() => Promise.resolve([])),
  },
  consumePendingVendorSelection: jest.fn(() => null),
}));
jest.mock('@/src/features/maintenance/api/requests/maintenanceRequests.api', () => ({
  archiveMaintenanceRequest: jest.fn(),
  unarchiveMaintenanceRequest: jest.fn(),
}));
jest.mock('@/src/features/maintenance/hooks', () => {
  const actual = jest.requireActual('@/src/features/maintenance/hooks/useCanReportIssue');
  return {
    ...actual,
    useMediaUpload: () => ({
      files: [],
      uploading: false,
      uploadProgress: 0,
      takePhoto: jest.fn(),
      pickMedia: jest.fn(),
      removeFile: jest.fn(),
      uploadFiles: jest.fn(),
      canAddMore: true,
    }),
    useMaintenanceRequests: () => ({
      requests: [],
      loading: false,
      error: null,
      refreshing: false,
      onRefresh: jest.fn(),
      refetch: jest.fn(),
    }),
  };
});

// The tenant's leases in the database; the query builder applies the
// .eq/.in filters the screen sends, like PostgREST would.
let mockLeases: { id: string; status: string; tenant_id: string; property_id: string }[] = [];
jest.mock('@/src/lib/supabase', () => {
  const query = () => {
    const filters: ((row: any) => boolean)[] = [];
    const builder: any = {
      select: () => builder,
      order: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push((row) => row[col] === val);
        return builder;
      },
      in: (col: string, vals: unknown[]) => {
        filters.push((row) => vals.includes(row[col]));
        return builder;
      },
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        Promise.resolve({
          data: mockLeases.filter((row) => filters.every((f) => f(row))),
          error: null,
        }).then(resolve, reject),
    };
    return builder;
  };
  return { supabase: { from: () => query() } };
});

const lease = (status: string) => [
  { id: 'lease-1', status, tenant_id: 'tenant-1', property_id: 'property-1' },
];

const UNSIGNED = [
  'draft',
  'pending_signatures',
  'pending_tenant_signature',
  'pending_owner_signature',
];

describe('CT7-066 Report Issue needs a lease signed by both', () => {
  describe('report screen (deep-link target)', () => {
    it.each(UNSIGNED)('refuses for a %s lease', async (status) => {
      mockLeases = lease(status);
      render(<TenantMaintenanceReportScreen />);
      expect(
        await screen.findByText(
          'You can report issues once your lease is signed by you and the owner.'
        )
      ).toBeTruthy();
      expect(screen.queryByText('Submit Request')).toBeNull();
    });

    it.each(['active', 'month_to_month', 'renewal_pending'])(
      'shows the form for a %s lease',
      async (status) => {
        mockLeases = lease(status);
        render(<TenantMaintenanceReportScreen />);
        expect(await screen.findByText('Submit Request')).toBeTruthy();
      }
    );
  });

  describe('maintenance list Report Issue buttons', () => {
    it.each(UNSIGNED)('hides Report Issue for a %s lease', async (status) => {
      mockLeases = lease(status);
      render(<TenantMaintenanceListScreen />);
      expect(await screen.findByTestId('maintenance-report-needs-lease')).toBeTruthy();
      expect(screen.queryByTestId('maintenance-report-fab')).toBeNull();
      expect(screen.queryByTestId('maintenance-report-cta')).toBeNull();
    });

    it('shows Report Issue for an active lease', async () => {
      mockLeases = lease('active');
      render(<TenantMaintenanceListScreen />);
      await waitFor(() => expect(screen.getByTestId('maintenance-report-fab')).toBeTruthy());
      expect(screen.getByTestId('maintenance-report-cta')).toBeTruthy();
      expect(screen.queryByTestId('maintenance-report-needs-lease')).toBeNull();
    });
  });
});
