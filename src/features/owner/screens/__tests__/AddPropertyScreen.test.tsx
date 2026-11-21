/**
 * Add Property wiring guards, rendered with the real screen.
 * CT7-027: Google address search (AddressSearch) was dropped from Add Property.
 * CT7-008: "Available From" was a typed YYYY-MM-DD TextInput, not a date picker.
 * CT7-009: the remove-photo × was 24×24 and hung half off the thumbnail.
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AddPropertyScreen from '../AddPropertyScreen';
import { PickerSheet } from '@/src/shared/components/ui/DateField';
import { toLocalIsoDate } from '@/src/features/leases/utils/leaseDateMath';
import { removeControls } from './removePhotoControl';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///a.jpg' }, { uri: 'file:///b.jpg' }],
  })),
  MediaTypeOptions: { Images: 'Images' },
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
// stands in for Google Places: pressing it "picks" a suggestion
jest.mock('../../components/AddressSearch', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable } = require('react-native');
  return {
    AddressSearch: ({ onSelect }: { onSelect: (a: object) => void }) => (
      <Pressable
        testID="address-search"
        onPress={() =>
          onSelect({
            address: '2 Datura Street',
            city: 'Verulam',
            province: 'KwaZulu-Natal',
            postalCode: '4339',
            latitude: -29.64,
            longitude: 31.05,
          })
        }
      />
    ),
  };
});
jest.mock('@/src/shared/components/ui/DateField', () => ({
  ...jest.requireActual('@/src/shared/components/ui/DateField'),
  PickerSheet: jest.fn(() => null),
}));

/** Props of the latest render of the "Available From" picker. */
function availableFromSheet() {
  const calls = (PickerSheet as unknown as jest.Mock).mock.calls
    .map(([p]) => p)
    .filter((p) => p.testID === 'owner-add-property-available-from');
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1];
}

beforeEach(() => jest.clearAllMocks());

it('picking a Google suggestion fills street, city, province and postal code (CT7-027)', () => {
  const screen = render(<AddPropertyScreen />);
  fireEvent.press(screen.getByTestId('address-search'));
  expect(screen.getByPlaceholderText('e.g., 12 Main Street, Rosebank').props.value).toBe(
    '2 Datura Street'
  );
  expect(screen.getByPlaceholderText('e.g., Johannesburg').props.value).toBe('Verulam');
  expect(screen.getByPlaceholderText('e.g., Gauteng').props.value).toBe('KwaZulu-Natal');
  expect(screen.getByPlaceholderText('2196').props.value).toBe('4339');
});

it('"Available From" opens a date picker and shows the picked date (CT7-008)', () => {
  const screen = render(<AddPropertyScreen />);
  const today = toLocalIsoDate(new Date());
  expect(availableFromSheet()).toMatchObject({ visible: false, mode: 'date' });

  fireEvent.press(screen.getByText(today));
  const open = availableFromSheet();
  expect(open).toMatchObject({ visible: true, mode: 'date' });
  // no dates in the past
  expect(toLocalIsoDate(open.minimumDate)).toBe(today);

  act(() => open.onDone(new Date(2027, 2, 15)));
  expect(availableFromSheet().visible).toBe(false);
  expect(screen.getByText('2027-03-15')).toBeTruthy();
  expect(screen.queryByText(today)).toBeNull();
});

it('remove-photo × is at least 32 px, inside the photo, and removes it (CT7-009)', async () => {
  const screen = render(<AddPropertyScreen />);
  fireEvent.press(screen.getByText('Select Photos'));
  await waitFor(() =>
    expect(removeControls(screen, 'owner-add-property-photo-remove')).toHaveLength(2)
  );

  for (const c of removeControls(screen, 'owner-add-property-photo-remove')) {
    expect(c.size.width).toBeGreaterThanOrEqual(32);
    expect(c.size.height).toBeGreaterThanOrEqual(32);
    expect(c.position.top).toBeGreaterThanOrEqual(0);
    expect(c.position.right).toBeGreaterThanOrEqual(0);
  }
  fireEvent.press(removeControls(screen, 'owner-add-property-photo-remove')[0].button);
  expect(removeControls(screen, 'owner-add-property-photo-remove')).toHaveLength(1);
});
