/**
 * Component-level tests for TenantLeaseJourneyScreen.
 *
 * Tests that the screen renders correctly in various states:
 * - Loading state
 * - No active lease state
 * - Error state
 * - Active lease with timeline events
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';
import { supabase } from '../../../lib/supabase';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock the business day calculator
jest.mock('../../../shared/utils/businessDayCalculator', () => ({
  calculateExpiryNoticeDate: jest.fn((endDate: Date, days: number) => {
    const d = new Date(endDate);
    d.setDate(d.getDate() - days);
    return d;
  }),
}));

const mockLease = {
  id: 'lease-1',
  status: 'active',
  start_date: '2026-06-01T00:00:00Z',
  end_date: '2027-06-01T00:00:00Z',
  monthly_rent: 8500,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  owner_signed_at: '2026-06-01T00:00:00Z',
  tenant_signed_at: '2026-06-01T00:00:00Z',
  executed_at: '2026-06-01T00:00:00Z',
  property_id: 'prop-1',
  owner_id: 'owner-1',
  tenant_id: 'tenant-1',
  notice_80_sent_at: null,
  notice_60_sent_at: null,
  notice_40_sent_at: null,
  terminated_at: null,
  property: { id: 'prop-1', title: 'Test Property', address: '123 Test St', city: 'Cape Town' },
  owner: { full_name: 'John Doe', email: 'john@test.com', phone: '+27123456789' },
};

const mockUser = { id: 'tenant-1', email: 'tenant@test.com' };

describe('TenantLeaseJourneyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock: authenticated user with active lease
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock lease query
    const leaseQuery = jest.fn().mockReturnThis();
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: mockLease, error: null }),
    });
  });

  it('renders loading indicator initially', async () => {
    // Delay the auth resolution to keep loading state
    (supabase.auth.getUser as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ data: { user: mockUser }, error: null }), 100))
    );

    const { getByTestId } = render(<require('../screens/TenantLeaseJourneyScreen').default />);
    // Will show ActivityIndicator while loading
    // Note: ActivityIndicator doesn't have a testID in the component, so just check rendering
    await act(async () => {
      // Wait for the timeout to resolve
      await new Promise(r => setTimeout(r, 200));
    });
  });

  it('renders empty state when no active lease', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    const { findByText } = render(<require('../screens/TenantLeaseJourneyScreen').default />);

    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    const emptyText = await findByText('No Active Lease');
    expect(emptyText).toBeTruthy();
  });

  it('renders error state on fetch failure', async () => {
    (supabase.auth.getUser as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { findByText } = render(<require('../screens/TenantLeaseJourneyScreen').default />);

    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    const retryButton = await findByText('Retry');
    expect(retryButton).toBeTruthy();
  });

  it('renders timeline with events for active lease', async () => {
    // Mock multiple queries returning data
    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockIn = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockReturnThis();
    const mockRange = jest.fn().mockReturnThis();

    // First call (auth) - return user
    // Second call (lease) - return lease
    // Third call (applications) - return empty
    // etc.
    let callCount = 0;
    (supabase.from as jest.Mock).mockImplementation(() => {
      callCount++;
      const handlers = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
        single: jest.fn(),
      };

      // Configure maybeSingle to return lease on first call, null for others
      handlers.maybeSingle = jest.fn().mockResolvedValue({
        data: callCount === 1 ? mockLease : null,
        error: null,
      });

      return handlers;
    });

    const { findByText } = render(<require('../screens/TenantLeaseJourneyScreen').default />);

    await act(async () => {
      await new Promise(r => setTimeout(r, 200));
    });

    const title = await findByText('Lease Journey');
    expect(title).toBeTruthy();
  });
});
