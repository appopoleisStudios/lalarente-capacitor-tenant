/**
 * CT7-020: lease start/end were typed YYYY-MM-DD text fields. Rendered with
 * the real screen: each field opens a date picker with the right minimum, the
 * picked dates are shown, and they are what the lease draft is built from.
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import OwnerLeaseCreateScreen from '../OwnerLeaseCreateScreen';
import { PickerSheet } from '@/src/shared/components/ui/DateField';
import { leaseDraftStore } from '../../../leases/utils/leaseDraftStore';
import { toLocalIsoDate } from '../../../leases/utils/leaseDateMath';
import { supabase } from '@/src/lib/supabase';

const mockRouter = { back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ applicationId: 'app-1' }),
}));
jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
jest.mock('@/src/shared/components/ui/DateField', () => ({
  ...jest.requireActual('@/src/shared/components/ui/DateField'),
  PickerSheet: jest.fn(() => null),
}));

const APPLICATION = {
  id: 'app-1',
  property_id: 'prop-1',
  tenant_id: 'tenant-1',
  monthly_income: 30000,
  property: { title: 'Sea View', rent_amount: 8500, deposit_amount: 17000 },
  tenant: { full_name: 'Nashin Indraj', email: null, phone: null },
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

/** Latest props of the picker for one field. */
function sheet(testID: string) {
  const calls = (PickerSheet as unknown as jest.Mock).mock.calls
    .map(([p]) => p)
    .filter((p) => p.testID === testID);
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1];
}

const START = 'owner-lease-create-start-date';
const END = 'owner-lease-create-end-date';

beforeEach(() => {
  jest.clearAllMocks();
  leaseDraftStore.clear();
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'owner-1' } } });
  (supabase.from as jest.Mock).mockReturnValue(query({ data: APPLICATION, error: null }));
});

it('start and end open date pickers; the picked dates are shown and used (CT7-020)', async () => {
  const screen = render(<OwnerLeaseCreateScreen />);
  await waitFor(() => expect(screen.getByTestId('owner-lease-create-review')).toBeTruthy());
  expect(sheet(START)).toMatchObject({ visible: false, mode: 'date' });

  // start: no date in the past
  fireEvent.press(screen.getByTestId(START));
  const start = sheet(START);
  expect(start).toMatchObject({ visible: true, mode: 'date' });
  expect(toLocalIsoDate(start.minimumDate)).toBe(toLocalIsoDate(new Date()));
  act(() => start.onDone(new Date(2030, 0, 31)));
  expect(sheet(START).visible).toBe(false);
  expect(screen.getByText('2030-01-31')).toBeTruthy();

  // end: at least one calendar month after the start
  fireEvent.press(screen.getByTestId(END));
  const end = sheet(END);
  expect(end).toMatchObject({ visible: true, mode: 'date' });
  expect(toLocalIsoDate(end.minimumDate)).toBe('2030-02-28');
  act(() => end.onDone(new Date(2031, 0, 30)));
  expect(sheet(END).visible).toBe(false);
  expect(screen.getByText('2031-01-30')).toBeTruthy();

  fireEvent.press(screen.getByTestId('owner-lease-create-review'));
  expect(leaseDraftStore.get()).toMatchObject({ startDate: '2030-01-31', endDate: '2031-01-30' });
  expect(mockRouter.push).toHaveBeenCalledWith('/(owner)/leases/review');
});
