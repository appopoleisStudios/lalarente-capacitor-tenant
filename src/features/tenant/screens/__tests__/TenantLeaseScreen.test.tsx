/**
 * CT7-012: a tenant with an incomplete profile could open the signature modal.
 * Rendered with the real screen and the real sign gate; only the profile
 * lookup is stubbed. Incomplete → an alert naming the missing fields with a
 * "Go to Profile" button, and the signature modal stays closed.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import TenantLeaseScreen from '../TenantLeaseScreen';
import { supabase } from '@/src/lib/supabase';
import { checkTenantProfileCompleteness } from '../../utils/profileCompleteness';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('../../utils/profileCompleteness', () => ({
  checkTenantProfileCompleteness: jest.fn(),
}));
jest.mock('../../../leases/components/SignatureModal', () => ({
  __esModule: true,
  default: ({ visible }: { visible: boolean }) => {
    const { Text: MockText } = require('react-native');
    return visible ? <MockText testID="signature-modal">signature</MockText> : null;
  },
}));
jest.mock('../../../leases/components/LeaseSignatureRow', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('@/src/shared/utils/printToPdf', () => ({ warmUpPrinter: jest.fn() }));
jest.mock('../../../leases/api/storageService', () => ({
  uploadSignature: jest.fn(),
  getLeaseDocumentUrl: jest.fn(),
}));
jest.mock('../../../leases/api/regenerateLeasePDF', () => ({ regenerateLeasePDF: jest.fn() }));
jest.mock('../../../leases/api/leasePdfService', () => ({ generateLeaseHTML: jest.fn() }));
jest.mock('../../../notifications/api/notificationsApi', () => ({ notificationsApi: {} }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const LEASE = {
  id: 'lease-1',
  property_id: 'prop-1',
  owner_id: 'owner-1',
  start_date: '2030-01-01',
  end_date: '2030-12-31',
  monthly_rent: 8500,
  deposit_amount: 17000,
  payment_due_day: 1,
  status: 'pending_tenant_signature',
  lease_type: 'fixed',
  property: { title: 'Sea View', address: '2 Datura Street', city: 'Verulam' },
  owner: { full_name: 'Owner', email: null, phone: null },
};

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

async function pressSign() {
  const screen = render(<TenantLeaseScreen />);
  await waitFor(() => expect(screen.getByTestId('tenant-lease-sign')).toBeTruthy());
  await act(async () => {
    fireEvent.press(screen.getByTestId('tenant-lease-sign'));
  });
  return screen;
}

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'tenant-1' } } });
  (supabase.from as jest.Mock).mockReturnValue(query({ data: LEASE, error: null }));
});

it('incomplete profile: alert lists the missing fields, signature modal stays closed', async () => {
  (checkTenantProfileCompleteness as jest.Mock).mockResolvedValue({
    status: 'ok',
    complete: false,
    missing: ['SA ID number', 'Monthly income'],
  });
  const screen = await pressSign();

  expect(checkTenantProfileCompleteness).toHaveBeenCalledWith('tenant-1');
  expect(alertSpy).toHaveBeenCalledTimes(1);
  const [title, message, buttons] = alertSpy.mock.calls[0];
  expect(title).toMatch(/complete your profile/i);
  expect(message).toContain('SA ID number');
  expect(message).toContain('Monthly income');
  expect(screen.queryByTestId('signature-modal')).toBeNull();

  const goToProfile = buttons.find((b: { text: string }) => b.text === 'Go to Profile');
  goToProfile.onPress();
  expect(mockRouter.push).toHaveBeenCalledWith('/(tenant)/profile');
});

it('complete profile: the signature modal opens with no alert', async () => {
  (checkTenantProfileCompleteness as jest.Mock).mockResolvedValue({
    status: 'ok',
    complete: true,
    missing: [],
  });
  const screen = await pressSign();
  expect(alertSpy).not.toHaveBeenCalled();
  expect(screen.getByTestId('signature-modal')).toBeTruthy();
});
