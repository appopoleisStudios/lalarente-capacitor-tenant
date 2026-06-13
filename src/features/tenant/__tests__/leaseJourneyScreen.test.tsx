// Mock external modules BEFORE any imports
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('../../../shared/utils/businessDayCalculator', () => ({
  calculateExpiryNoticeDate: (d: Date) => d,
}));

// Mock supabase so fetchers return empty/controlled data
const mockFrom = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import TenantLeaseJourneyScreen from '../screens/TenantLeaseJourneyScreen';

describe('TenantLeaseJourneyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: supabase queries return empty data
    mockFrom.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          in: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() =>
                  Promise.resolve({ data: null, error: null })
                ),
              })),
            })),
          })),
          order: jest.fn(() => ({
            limit: jest.fn(() =>
              Promise.resolve({ data: [], error: null })
            ),
          })),
        })),
      })),
    });
  });

  it('renders without crashing', () => {
    expect(() => render(<TenantLeaseJourneyScreen />)).not.toThrow();
  });
});
