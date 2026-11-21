/**
 * Add Property wiring guards, rendered with the real screen.
 * CT7-027: Google address search (AddressSearch) was dropped from Add Property.
 * CT7-008: "Available From" was a typed YYYY-MM-DD TextInput, not a date picker.
 */
import React from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { styles as addStyles } from '../AddPropertyScreen.styles';
import { styles as editStyles } from '../EditPropertyScreen.styles';
import { render } from '@testing-library/react-native';
import AddPropertyScreen from '../AddPropertyScreen';
import { PickerSheet } from '@/src/shared/components/ui/DateField';
import { toLocalIsoDate } from '@/src/features/leases/utils/leaseDateMath';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('../../components/AddressSearch', () => {
  const { View } = require('react-native');
  return { AddressSearch: () => <View testID="address-search" /> };
});
jest.mock('@/src/shared/components/ui/DateField', () => ({
  ...jest.requireActual('@/src/shared/components/ui/DateField'),
  PickerSheet: jest.fn(() => null),
}));

beforeEach(() => jest.clearAllMocks());

it('renders the Google address search (CT7-027)', () => {
  expect(render(<AddPropertyScreen />).getByTestId('address-search')).toBeTruthy();
});

it('"Available From" is a date picker, not a text field (CT7-008)', () => {
  const screen = render(<AddPropertyScreen />);
  const sheets = (PickerSheet as unknown as jest.Mock).mock.calls.map(([p]) => p);
  expect(sheets).toContainEqual(
    expect.objectContaining({ testID: 'owner-add-property-available-from', mode: 'date' })
  );
  // the field defaults to today; no typed input holds it
  const today = toLocalIsoDate(new Date());
  const typed = screen.UNSAFE_getAllByType(TextInput).filter((t) => t.props.value === today);
  expect(typed).toEqual([]);
  expect(screen.getByText(today)).toBeTruthy();
});

// CT7-009: the remove-photo × was 24×24 and hung half off the thumbnail, so
// the client thought photos could not be deleted. Add and Edit share the fix.
it.each([
  ['Add Property', addStyles],
  ['Edit Property', editStyles],
])('%s remove-photo button is at least 32 px and inside the photo (CT7-009)', (_, s) => {
  const button = StyleSheet.flatten(s.photoRemove);
  const wrap = StyleSheet.flatten(s.photoRemoveWrap);
  expect(button.width).toBeGreaterThanOrEqual(32);
  expect(button.height).toBeGreaterThanOrEqual(32);
  expect(wrap.top).toBeGreaterThanOrEqual(0);
  expect(wrap.right).toBeGreaterThanOrEqual(0);
});
