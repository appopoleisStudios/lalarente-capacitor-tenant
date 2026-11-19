/**
 * CT7-066 regression: Report Issue is between owner and tenant, so it exists
 * only when the tenant's lease is signed by both and in effect. A lease still
 * awaiting a signature must not expose the Report Issue entry point, and the
 * report screen (reachable by deep link) must refuse instead of showing the
 * form.
 */
import React, { useEffect as mockUseEffect } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
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
// Set to make the lease query fail, like a network/PostgREST error
let mockLeaseError: { message: string } | null = null;
let mockLeaseQueries = 0;
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
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        mockLeaseQueries += 1;
        return Promise.resolve(
          mockLeaseError
            ? { data: null, error: mockLeaseError }
            : { data: mockLeases.filter((row) => filters.every((f) => f(row))), error: null }
        ).then(resolve, reject);
      },
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

const NEEDS_LEASE = 'You can report issues once your lease is signed by you and the owner.';

describe('CT7-066 Report Issue needs a lease signed by both', () => {
  beforeEach(() => {
    mockLeaseError = null;
    mockLeaseQueries = 0;
  });

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

    it('says the lease check failed (not "No Active Lease") when the query errors', async () => {
      mockLeases = lease('active');
      mockLeaseError = { message: 'Network request failed' };
      render(<TenantMaintenanceReportScreen />);
      expect(await screen.findByText("Couldn't check your lease")).toBeTruthy();
      expect(screen.getByTestId('maintenance-report-retry')).toBeTruthy();
      expect(screen.queryByText('No Active Lease')).toBeNull();
      expect(screen.queryByText(NEEDS_LEASE)).toBeNull();
      expect(screen.queryByText('Submit Request')).toBeNull();
    });
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

    it('shows neither the buttons nor the needs-lease note when the check errors', async () => {
      mockLeases = lease('pending_owner_signature');
      mockLeaseError = { message: 'Network request failed' };
      render(<TenantMaintenanceListScreen />);
      await waitFor(() => expect(mockLeaseQueries).toBeGreaterThan(0));
      await act(async () => {});
      expect(screen.queryByTestId('maintenance-report-needs-lease')).toBeNull();
      expect(screen.queryByTestId('maintenance-report-fab')).toBeNull();
      expect(screen.queryByTestId('maintenance-report-cta')).toBeNull();
    });
  });
});
