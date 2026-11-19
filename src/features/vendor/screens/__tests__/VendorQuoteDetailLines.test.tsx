/**
 * CT7-054 (SA #259): the vendor quote detail screen showed only subtotal / VAT
 * / total — the line items the vendor submitted were never loaded.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import VendorQuoteDetailScreen from '../VendorQuoteDetailScreen';
import { getQuoteById, getQuoteLines, getQuoteRevisions } from '@/src/features/maintenance/api';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ quoteId: 'quote-9' }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, []),
}));
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'vendor-1' } }) }));
jest.mock('@/src/features/maintenance/api', () => ({
  getQuoteById: jest.fn(),
  getQuoteLines: jest.fn(),
  getQuoteRevisions: jest.fn(),
  updateQuote: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: {} }));

function quote(status: string) {
  return {
    id: 'quote-9',
    status,
    subtotal: 5500,
    vat_amount: 825,
    discount_amount: 0,
    total_amount: 6325,
    notes: 'LC note',
    created_at: '2026-11-18T11:00:00Z',
  };
}

const LINES = [
  { id: 'l1', quote_id: 'quote-9', description: 'Replace tap washer', qty: 2, unit_price: 250 },
  { id: 'l2', quote_id: 'quote-9', description: 'Call-out fee', qty: 1, unit_price: 5000 },
];

describe('vendor quote detail: line items (CT7-054)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getQuoteRevisions as jest.Mock).mockResolvedValue([]);
  });

  it.each(['requested', 'submitted', 'approved', 'rejected', 'revision_requested'])(
    'a %s quote lists each line with quantity, unit price and amount',
    async (status) => {
      (getQuoteById as jest.Mock).mockResolvedValue(quote(status));
      (getQuoteLines as jest.Mock).mockResolvedValue(LINES);
      const ui = render(<VendorQuoteDetailScreen />);
      await waitFor(() => expect(ui.getByTestId('quote-line-items')).toBeTruthy());
      expect(getQuoteLines).toHaveBeenCalledWith('quote-9');
      expect(ui.getByText('Replace tap washer')).toBeTruthy();
      expect(ui.getByText('2 × R 250')).toBeTruthy();
      expect(ui.getByText('R 500')).toBeTruthy();
      expect(ui.getByText('Call-out fee')).toBeTruthy();
      expect(ui.getByText('Cost Breakdown')).toBeTruthy();
    }
  );

  it('a quote without lines shows no empty Line Items section', async () => {
    (getQuoteById as jest.Mock).mockResolvedValue(quote('submitted'));
    (getQuoteLines as jest.Mock).mockResolvedValue([]);
    const ui = render(<VendorQuoteDetailScreen />);
    await waitFor(() => expect(ui.getByText('Cost Breakdown')).toBeTruthy());
    expect(ui.queryByTestId('quote-line-items')).toBeNull();
  });
});
