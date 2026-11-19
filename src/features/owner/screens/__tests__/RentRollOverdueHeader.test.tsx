/**
 * CT7-063: the Rent Roll header "Overdue" card counted pending payment rows
 * due before "now" (paymentsApi.getPaymentStats, now removed), so it disagreed with the
 * Overdue badges below it and with the dashboard. It now counts the
 * tenancies whose badge says Overdue, the same rule as summarizeArrears.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import OwnerRentRollScreen from '../OwnerRentRollScreen';
import { summarizeArrears } from '../../utils/rentRollStatus';
import {
  ARREARS_NOW,
  ARREARS_TODAY,
  arrearsPayments,
  arrearsProperties,
} from '../../api/__tests__/arrearsFixture';

// Every payments query resolves to the fixture, so the real
// paymentsApi.getOwnerPayments sees it.
jest.mock('@/src/lib/supabase', () => {
  const { arrearsPayments: rows } = jest.requireActual('../../api/__tests__/arrearsFixture');
  const result = { data: rows, error: null };
  const query: any = new Proxy(
    {},
    {
      get: (_t, key) => (key === 'then' ? (resolve: any) => resolve(result) : () => query),
    }
  );
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } } }) },
      from: () => query,
    },
  };
});
jest.mock('@/src/features/properties/api/propertiesApi', () => ({
  propertiesApi: {
    getOwnerProperties: async () =>
      jest.requireActual('../../api/__tests__/arrearsFixture').arrearsProperties,
  },
}));
jest.mock('@/src/features/notifications/api/notificationsApi', () => ({ notificationsApi: {} }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

describe('Rent Roll header Overdue matches the badges and the dashboard (CT7-063)', () => {
  beforeEach(() => jest.useFakeTimers({ now: ARREARS_NOW }));
  afterEach(() => jest.useRealTimers());

  it('counts the tenancies badged Overdue (failed + partial), not pending rows', async () => {
    const expected = summarizeArrears(arrearsProperties, arrearsPayments, ARREARS_TODAY).count;
    expect(expected).toBe(2);

    render(<OwnerRentRollScreen />);
    const card = await waitFor(() => screen.getByTestId('rent-roll-overdue-count'));
    expect(card).toHaveTextContent(String(expected));
    // "Overdue" = the header label + the filter chip + one badge per overdue tenancy
    expect(screen.getAllByText('Overdue')).toHaveLength(2 + expected);
  });
});
