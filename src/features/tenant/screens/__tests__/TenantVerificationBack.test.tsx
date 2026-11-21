/**
 * CT7-074 (CT7-033 rule: Back on every screen). "Verify Completed Work" had
 * no back arrow on its main view, only on its Approve / Report sub-views.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TenantVerificationScreen from '../TenantVerificationScreen';

const mockRouter = { back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(), push: jest.fn() };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ requestId: 'r1', completionNotes: 'Fixed the tap' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/src/lib/supabase', () => ({
  supabase: { auth: { getUser: () => Promise.resolve({ data: { user: { id: 't1' } } }) } },
}));
jest.mock('@/src/lib/storage', () => ({ uploadFile: jest.fn() }));
jest.mock('expo-image-picker', () => ({}));

beforeEach(() => jest.clearAllMocks());

describe('Verify Completed Work back arrow (CT7-074)', () => {
  it('goes back to the previous screen', () => {
    mockRouter.canGoBack.mockReturnValue(true);
    const ui = render(<TenantVerificationScreen />);
    expect(ui.getByTestId('tenant-verify-title')).toBeTruthy();
    fireEvent.press(ui.getByTestId('tenant-verify-back'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('opened from a link (no history): goes to the tenant home', () => {
    mockRouter.canGoBack.mockReturnValue(false);
    const ui = render(<TenantVerificationScreen />);
    fireEvent.press(ui.getByTestId('tenant-verify-back'));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/(tenant)');
  });
});
