/**
 * Signing out must end only this device's session. The default ('global')
 * revoked the user's sessions on every device.
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';

const mockSignOut = jest.fn().mockResolvedValue({ error: null });
jest.mock('@/src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
    from: jest.fn(),
  },
}));
jest.mock('@/src/features/maintenance/api/vendors/pendingVendorSelection', () => ({
  clearPendingVendorSelection: jest.fn(),
}));
const mockClearCaches = jest.fn().mockResolvedValue(undefined);
jest.mock('@/src/shared/utils/dashboardCache', () => ({
  clearDashboardCaches: () => mockClearCaches(),
}));

const mockUnregister = jest.fn().mockResolvedValue(undefined);
jest.mock('@/src/features/notifications/registerPush', () => ({
  unregisterDevicePush: () => mockUnregister(),
}));

import { AuthProvider, useAuth } from '../AuthContext';

it('signs out of this device only and clears cached dashboards', async () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current).toBeTruthy());
  await act(async () => {
    await result.current.signOut();
  });
  expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  // push token removed while the session still existed
  expect(mockUnregister).toHaveBeenCalled();
  expect(mockUnregister.mock.invocationCallOrder[0]).toBeLessThan(
    mockSignOut.mock.invocationCallOrder[0]
  );
  expect(mockClearCaches).toHaveBeenCalled();
});
