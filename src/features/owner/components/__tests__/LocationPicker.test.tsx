/**
 * Edit Property's map + Google Places picker, rendered with the real component.
 * CT7-006: listViewDisplayed={false} hard-hid the results, so search "returned nothing".
 * CT7-005: the results list flowed inline and sat on top of the input; it must float.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { LocationPicker } from '../LocationPicker';

jest.mock('react-native-google-places-autocomplete', () => ({
  GooglePlacesAutocomplete: jest.fn(() => null),
}));
jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Marker: View, PROVIDER_GOOGLE: 'google' };
});

function autocompleteProps() {
  render(<LocationPicker onLocationSelect={jest.fn()} />);
  const calls = (GooglePlacesAutocomplete as unknown as jest.Mock).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0];
}

it('does not hide the suggestion list (CT7-006)', () => {
  expect(autocompleteProps()).not.toHaveProperty('listViewDisplayed');
});

it('floats the suggestion list over the content below the input (CT7-005)', () => {
  const list = StyleSheet.flatten(autocompleteProps().styles.listView);
  expect(list.position).toBe('absolute');
});
