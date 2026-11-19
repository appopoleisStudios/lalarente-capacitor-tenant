/**
 * CT7-054: a vendor could not open the quote they submitted — the job screen
 * showed only its status and total, `handleViewQuote` was never wired up and
 * the quote detail route (line items, terms) had no way in.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import VendorMaintenanceDetail from '../../../../../app/(vendor)/maintenance/[id]';
import { getVendorRequestById } from '@/src/features/maintenance/api';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 'req-1' }),
  useFocusEffect: (effect: () => void) => {
    require('react').useEffect(effect, []);
  },
}));
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'vendor-1' } }) }));
jest.mock('@/src/features/maintenance/api', () => ({ getVendorRequestById: jest.fn() }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

function request(quoteStatus: string) {
  return {
    id: 'req-1',
    title: 'Leaking tap',
    description: 'Kitchen tap drips',
    priority: 'medium',
    status: 'assigned',
    category: 'plumbing',
    created_at: '2026-11-18T10:00:00Z',
    images: [],
    property: { title: '2B Datura', address: '2 Datura Street' },
    my_quote: {
      id: 'quote-9',
      status: quoteStatus,
      total_amount: 1500,
      created_at: '2026-11-18T11:00:00Z',
      revision_reason: null,
    },
  };
}

describe('vendor job screen: View Quote (CT7-054)', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['requested', 'submitted', 'approved', 'rejected', 'revision_requested'])(
    'a %s quote opens its detail screen',
    async (status) => {
      (getVendorRequestById as jest.Mock).mockResolvedValue(request(status));
      const ui = render(<VendorMaintenanceDetail />);
      await waitFor(() => expect(ui.getByTestId('vendor-view-quote')).toBeTruthy());
      fireEvent.press(ui.getByTestId('vendor-view-quote'));
      expect(router.push).toHaveBeenCalledWith('/(vendor)/maintenance/req-1/quote/quote-9');
    }
  );

  it('no quote yet: no View Quote button', async () => {
    (getVendorRequestById as jest.Mock).mockResolvedValue({
      ...request('submitted'),
      my_quote: undefined,
      status: 'open',
    });
    const ui = render(<VendorMaintenanceDetail />);
    await waitFor(() => expect(getVendorRequestById).toHaveBeenCalled());
    await waitFor(() => expect(ui.queryByText('Leaking tap')).toBeTruthy());
    expect(ui.queryByTestId('vendor-view-quote')).toBeNull();
  });
});
