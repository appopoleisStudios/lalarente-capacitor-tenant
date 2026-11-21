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
  // omitted (library default) or explicitly 'auto': shown while there are results
  expect([undefined, 'auto']).toContain(autocompleteProps().listViewDisplayed);
});

describe('suggestion list floats below the input, over the map (CT7-005)', () => {
  const props = () => autocompleteProps().styles;

  it('is taken out of the flow and starts below the input', () => {
    const { listView, textInput } = props();
    const list = StyleSheet.flatten(listView);
    const input = StyleSheet.flatten(textInput);
    expect(list.position).toBe('absolute');
    expect(typeof input.height).toBe('number');
    expect(list.top).toBeGreaterThanOrEqual(input.height);
  });

  it('stacks above the content after it (zIndex on iOS, elevation on Android)', () => {
    const { listView, container } = props();
    const list = StyleSheet.flatten(listView);
    const box = StyleSheet.flatten(container);
    // the map and "Selected" card have no zIndex/elevation of their own
    expect(list.zIndex).toBeGreaterThan(0);
    expect(list.elevation).toBeGreaterThan(0);
    expect(box.zIndex).toBeGreaterThan(0);
    expect(box.elevation).toBeGreaterThan(0);
  });
});
