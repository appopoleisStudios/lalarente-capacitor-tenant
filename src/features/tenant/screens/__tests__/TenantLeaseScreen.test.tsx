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
import { uploadSignature } from '../../../leases/api/storageService';
import { notificationsApi } from '../../../notifications/api/notificationsApi';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
// useFocusEffect runs like a mount effect; mockRefocus() replays it the way
// expo-router does when the (still mounted) tab screen is shown again.
let mockFocusCallback: (() => void) | null = null;
const mockRefocus = () => mockFocusCallback?.();
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (cb: () => void) => {
    mockFocusCallback = cb;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(() => cb(), [cb]);
  },
}));
jest.mock('../../utils/profileCompleteness', () => ({
  checkTenantProfileCompleteness: jest.fn(),
}));
// The latest onSave the screen handed the signature pad (CT7-075 tests).
let mockSignatureOnSave: ((sig: string) => Promise<void>) | null = null;
jest.mock('../../../leases/components/SignatureModal', () => ({
  __esModule: true,
  default: ({ visible, onSave }: { visible: boolean; onSave: (s: string) => Promise<void> }) => {
    mockSignatureOnSave = onSave;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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

// CT7-075 (client, build 15): the tenant opened My Lease while their old lease
// was the newest; the owner then sent a new lease. The dashboard said "Sign
// Lease Now", but My Lease — a tab screen that stays mounted — still showed
// the old, signed lease with no Sign button, because it loaded only on mount.
it('CT7-075: shown again after the owner sends a new lease → shows it with the Sign button', async () => {
  const oldSigned = {
    ...LEASE,
    id: 'lease-old',
    status: 'active',
    property: { ...LEASE.property, title: '2B Datura' },
  };
  const newPending = {
    ...LEASE,
    id: 'lease-new',
    property: { ...LEASE.property, title: '2A Datura' },
  };
  (supabase.from as jest.Mock).mockReturnValue(query({ data: oldSigned, error: null }));
  const screen = render(<TenantLeaseScreen />);
  await waitFor(() => expect(screen.getByText('2B Datura')).toBeTruthy());
  expect(screen.queryByTestId('tenant-lease-sign')).toBeNull();

  (supabase.from as jest.Mock).mockReturnValue(query({ data: newPending, error: null }));
  await act(async () => {
    mockRefocus();
  });

  await waitFor(() => expect(screen.getByTestId('tenant-lease-sign')).toBeTruthy());
  expect(screen.getByText('2A Datura')).toBeTruthy();
  expect(screen.queryByText('2B Datura')).toBeNull();
});

it('CT7-075: shown again after the lease is gone → no stale lease left on screen', async () => {
  const screen = render(<TenantLeaseScreen />);
  await waitFor(() => expect(screen.getByTestId('tenant-lease-sign')).toBeTruthy());

  (supabase.from as jest.Mock).mockReturnValue(
    query({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
  );
  await act(async () => {
    mockRefocus();
  });

  await waitFor(() => expect(screen.getByText('No Active Lease')).toBeTruthy());
  expect(screen.queryByTestId('tenant-lease-sign')).toBeNull();
  expect(screen.queryByText('Sea View')).toBeNull();

  // shown again once the owner sends a lease → straight to it, no error flash
  (supabase.from as jest.Mock).mockReturnValue(query({ data: LEASE, error: null }));
  await act(async () => {
    mockRefocus();
  });
  await waitFor(() => expect(screen.getByTestId('tenant-lease-sign')).toBeTruthy());
  expect(screen.queryByText(/Failed to load lease/)).toBeNull();
});

it('CT7-075: overlapping reloads — a slow older answer never brings back the old lease', async () => {
  const oldSigned = {
    ...LEASE,
    id: 'lease-old',
    status: 'active',
    property: { ...LEASE.property, title: '2B Datura' },
  };
  const newPending = {
    ...LEASE,
    id: 'lease-new',
    property: { ...LEASE.property, title: '2A Datura' },
  };
  let releaseSlow: (v: unknown) => void = () => {};
  const slow = new Promise((resolve) => {
    releaseSlow = resolve;
  });
  // first load (mount) is slow and answers with the old lease; the reload is fast
  (supabase.from as jest.Mock)
    .mockReturnValueOnce(query(slow))
    .mockReturnValue(query({ data: newPending, error: null }));
  const screen = render(<TenantLeaseScreen />);
  await act(async () => {
    mockRefocus();
  });
  await waitFor(() => expect(screen.getByText('2A Datura')).toBeTruthy());

  await act(async () => {
    releaseSlow({ data: oldSigned, error: null });
    await slow;
  });
  expect(screen.getByText('2A Datura')).toBeTruthy();
  expect(screen.queryByText('2B Datura')).toBeNull();
  expect(screen.getByTestId('tenant-lease-sign')).toBeTruthy();
});

it('CT7-075: a reload that brings another lease closes the signature pad and never signs it', async () => {
  (checkTenantProfileCompleteness as jest.Mock).mockResolvedValue({
    status: 'ok',
    complete: true,
    missing: [],
  });
  const screen = await pressSign();
  await waitFor(() => expect(screen.getByTestId('signature-modal')).toBeTruthy());

  const other = { ...LEASE, id: 'lease-2', property: { ...LEASE.property, title: '2A Datura' } };
  (supabase.from as jest.Mock).mockReturnValue(query({ data: other, error: null }));
  await act(async () => {
    mockRefocus();
  });
  await waitFor(() => expect(screen.getByText('2A Datura')).toBeTruthy());
  expect(screen.queryByTestId('signature-modal')).toBeNull();

  // the pad's save handler as of now (the screen re-rendered with lease-2)
  // must not put the signature on a lease the tenant never opened the pad for
  await act(async () => {
    await mockSignatureOnSave!('data:image/png;base64,AAAA');
  });
  expect(uploadSignature).not.toHaveBeenCalled();
});

// ── CT7-075 SA round 2: nothing acts on a lease while a reload is pending ──

/** A promise the test resolves (or rejects) later. */
function deferred<T = unknown>() {
  let resolve: (v: T) => void = () => {};
  let reject: (e: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const OLD = { ...LEASE, id: 'lease-old', property: { ...LEASE.property, title: '2B Datura' } };
const NEW = { ...LEASE, id: 'lease-new', property: { ...LEASE.property, title: '2A Datura' } };
const COMPLETE = { status: 'ok', complete: true, missing: [] };

it('CT7-075: while a reload is pending, Sign does nothing (no gate, no pad)', async () => {
  (checkTenantProfileCompleteness as jest.Mock).mockResolvedValue(COMPLETE);
  const screen = render(<TenantLeaseScreen />);
  await waitFor(() => expect(screen.getByTestId('tenant-lease-sign')).toBeTruthy());

  const pending = deferred();
  (supabase.from as jest.Mock).mockReturnValue(query(pending.promise));
  await act(async () => {
    mockRefocus();
  });
  await act(async () => {
    fireEvent.press(screen.getByTestId('tenant-lease-sign'));
  });
  expect(checkTenantProfileCompleteness).not.toHaveBeenCalled();
  expect(screen.queryByTestId('signature-modal')).toBeNull();

  // once the reload answers, signing works again
  await act(async () => {
    pending.resolve({ data: LEASE, error: null });
    await pending.promise;
  });
  await act(async () => {
    fireEvent.press(screen.getByTestId('tenant-lease-sign'));
  });
  await waitFor(() => expect(screen.getByTestId('signature-modal')).toBeTruthy());
});

it('CT7-075: a profile check that finishes after the lease was replaced opens no pad', async () => {
  const gate = deferred();
  (checkTenantProfileCompleteness as jest.Mock).mockReturnValue(gate.promise);
  (supabase.from as jest.Mock).mockReturnValue(query({ data: OLD, error: null }));
  const screen = render(<TenantLeaseScreen />);
  await waitFor(() => expect(screen.getByTestId('tenant-lease-sign')).toBeTruthy());
  await act(async () => {
    fireEvent.press(screen.getByTestId('tenant-lease-sign'));
  });

  (supabase.from as jest.Mock).mockReturnValue(query({ data: NEW, error: null }));
  await act(async () => {
    mockRefocus();
  });
  await waitFor(() => expect(screen.getByText('2A Datura')).toBeTruthy());

  await act(async () => {
    gate.resolve(COMPLETE);
    await gate.promise;
  });
  expect(screen.queryByTestId('signature-modal')).toBeNull();
});

it('CT7-075: a slow older reload that fails shows no error over the newer lease', async () => {
  const slow = deferred();
  (supabase.from as jest.Mock)
    .mockReturnValueOnce(query(slow.promise))
    .mockReturnValue(query({ data: NEW, error: null }));
  const screen = render(<TenantLeaseScreen />);
  await act(async () => {
    mockRefocus();
  });
  await waitFor(() => expect(screen.getByText('2A Datura')).toBeTruthy());

  await act(async () => {
    slow.reject(new Error('Network request failed'));
    await slow.promise.catch(() => {});
  });
  expect(screen.getByText('2A Datura')).toBeTruthy();
  expect(screen.queryByText(/Network request failed|Failed to load lease/)).toBeNull();
  expect(screen.getByTestId('tenant-lease-sign')).toBeTruthy();
});

it('CT7-075: the old lease wording failing after a reload raises no alert and shows nothing', async () => {
  (supabase.from as jest.Mock).mockReturnValue(query({ data: OLD, error: null }));
  const screen = render(<TenantLeaseScreen />);
  await waitFor(() => expect(screen.getByTestId('tenant-lease-read-full')).toBeTruthy());

  const wording = deferred();
  (supabase.from as jest.Mock).mockReturnValue(query(wording.promise));
  await act(async () => {
    fireEvent.press(screen.getByTestId('tenant-lease-read-full'));
  });

  (supabase.from as jest.Mock).mockReturnValue(query({ data: NEW, error: null }));
  await act(async () => {
    mockRefocus();
  });
  await waitFor(() => expect(screen.getByText('2A Datura')).toBeTruthy());

  await act(async () => {
    wording.resolve({ data: null, error: { message: 'boom' } });
    await wording.promise;
  });
  expect(alertSpy).not.toHaveBeenCalled();
  expect(screen.queryByTestId('tenant-lease-full-close')).toBeNull();
});

it('CT7-075: reloading from "No Active Lease" keeps that screen until the answer — no error flash', async () => {
  (supabase.from as jest.Mock).mockReturnValue(
    query({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
  );
  const screen = render(<TenantLeaseScreen />);
  await waitFor(() => expect(screen.getByText('No Active Lease')).toBeTruthy());

  const pending = deferred();
  (supabase.from as jest.Mock).mockReturnValue(query(pending.promise));
  await act(async () => {
    mockRefocus();
  });
  expect(screen.getByText('No Active Lease')).toBeTruthy();
  expect(screen.queryByText(/Failed to load lease/)).toBeNull();

  await act(async () => {
    pending.resolve({ data: NEW, error: null });
    await pending.promise;
  });
  await waitFor(() => expect(screen.getByTestId('tenant-lease-sign')).toBeTruthy());
});

it('CT7-075: the "signed" alert reload and a focus reload overlap — the latest answer wins', async () => {
  (checkTenantProfileCompleteness as jest.Mock).mockResolvedValue(COMPLETE);
  (uploadSignature as jest.Mock).mockResolvedValue('signatures/lease-1.png');
  (notificationsApi as unknown as { sendNotification: jest.Mock }).sendNotification = jest
    .fn()
    .mockResolvedValue(undefined);
  const screen = await pressSign();
  await waitFor(() => expect(screen.getByTestId('signature-modal')).toBeTruthy());
  await act(async () => {
    await mockSignatureOnSave!('data:image/png;base64,AAAA');
  });
  const okButton = alertSpy.mock.calls
    .flatMap((c) => (c[2] as { text: string; onPress?: () => void }[] | undefined) ?? [])
    .find((b) => b.text === 'OK' && b.onPress);
  expect(okButton).toBeTruthy();

  // focus reload first (slow, answers with the stale row), then the alert's reload (fast)
  const slow = deferred();
  const signed = {
    ...LEASE,
    status: 'pending_owner_signature',
    property: { ...LEASE.property, title: 'Signed Lease' },
  };
  (supabase.from as jest.Mock)
    .mockReturnValueOnce(query(slow.promise))
    .mockReturnValue(query({ data: signed, error: null }));
  await act(async () => {
    mockRefocus();
  });
  await act(async () => {
    okButton!.onPress!();
  });
  await waitFor(() => expect(screen.getByText('Signed Lease')).toBeTruthy());

  await act(async () => {
    slow.resolve({ data: LEASE, error: null });
    await slow.promise;
  });
  expect(screen.getByText('Signed Lease')).toBeTruthy();
  expect(screen.queryByTestId('tenant-lease-sign')).toBeNull();
});

// ── CT7-075 SA round 3: same lease id, changed lease — pending work is dropped ──

const SIGNED_SAME = {
  ...LEASE,
  status: 'pending_owner_signature',
  property: { ...LEASE.property, title: 'Already Signed' },
};

it('CT7-075: same lease reloaded as signed during the profile check → no pad', async () => {
  const gate = deferred();
  (checkTenantProfileCompleteness as jest.Mock).mockReturnValue(gate.promise);
  const screen = render(<TenantLeaseScreen />);
  await waitFor(() => expect(screen.getByTestId('tenant-lease-sign')).toBeTruthy());
  await act(async () => {
    fireEvent.press(screen.getByTestId('tenant-lease-sign'));
  });

  (supabase.from as jest.Mock).mockReturnValue(query({ data: SIGNED_SAME, error: null }));
  await act(async () => {
    mockRefocus();
  });
  await waitFor(() => expect(screen.getByText('Already Signed')).toBeTruthy());

  await act(async () => {
    gate.resolve(COMPLETE);
    await gate.promise;
  });
  expect(screen.queryByTestId('signature-modal')).toBeNull();
});

it('CT7-075: same lease reloaded while its wording loads → the old wording is not shown', async () => {
  const screen = render(<TenantLeaseScreen />);
  await waitFor(() => expect(screen.getByTestId('tenant-lease-read-full')).toBeTruthy());

  const wording = deferred();
  (supabase.from as jest.Mock).mockReturnValue(query(wording.promise));
  await act(async () => {
    fireEvent.press(screen.getByTestId('tenant-lease-read-full'));
  });
  (supabase.from as jest.Mock).mockReturnValue(query({ data: LEASE, error: null }));
  await act(async () => {
    mockRefocus();
  });
  await waitFor(() => expect(screen.getByTestId('tenant-lease-sign')).toBeTruthy());

  await act(async () => {
    wording.resolve({ data: LEASE, error: null });
    await wording.promise;
  });
  expect(screen.queryByTestId('tenant-lease-full-close')).toBeNull();
  expect(alertSpy).not.toHaveBeenCalled();
});

it('CT7-075: same lease reloaded as signed while the pad is open → pad closes, nothing is signed', async () => {
  (checkTenantProfileCompleteness as jest.Mock).mockResolvedValue(COMPLETE);
  const screen = await pressSign();
  await waitFor(() => expect(screen.getByTestId('signature-modal')).toBeTruthy());

  (supabase.from as jest.Mock).mockReturnValue(query({ data: SIGNED_SAME, error: null }));
  await act(async () => {
    mockRefocus();
  });
  await waitFor(() => expect(screen.getByText('Already Signed')).toBeTruthy());
  expect(screen.queryByTestId('signature-modal')).toBeNull();

  await act(async () => {
    await mockSignatureOnSave!('data:image/png;base64,AAAA');
  });
  expect(uploadSignature).not.toHaveBeenCalled();
});

it('CT7-075: an older reload finishing while a newer one is pending leaves Sign blocked', async () => {
  (checkTenantProfileCompleteness as jest.Mock).mockResolvedValue(COMPLETE);
  const screen = render(<TenantLeaseScreen />);
  await waitFor(() => expect(screen.getByTestId('tenant-lease-sign')).toBeTruthy());

  const older = deferred();
  const newer = deferred();
  (supabase.from as jest.Mock)
    .mockReturnValueOnce(query(older.promise))
    .mockReturnValueOnce(query(newer.promise));
  await act(async () => {
    mockRefocus();
  });
  await act(async () => {
    mockRefocus();
  });
  await act(async () => {
    older.resolve({ data: LEASE, error: null });
    await older.promise;
  });
  await act(async () => {
    fireEvent.press(screen.getByTestId('tenant-lease-sign'));
  });
  expect(checkTenantProfileCompleteness).not.toHaveBeenCalled();
  expect(screen.queryByTestId('signature-modal')).toBeNull();

  await act(async () => {
    newer.resolve({ data: LEASE, error: null });
    await newer.promise;
  });
  await act(async () => {
    fireEvent.press(screen.getByTestId('tenant-lease-sign'));
  });
  await waitFor(() => expect(screen.getByTestId('signature-modal')).toBeTruthy());
});
