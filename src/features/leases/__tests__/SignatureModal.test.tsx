/**
 * Client test of build 11 (Navin, 96 De Waal): neither owner nor tenant could
 * sign a lease on Android. The signature modal used React Native's
 * SafeAreaView, which pads only on iOS; with edge-to-edge on Android the
 * Clear / Confirm Signature buttons sat under the system navigation bar and
 * taps went to the OS instead. The modal must pad itself by the device's
 * safe-area insets on every platform.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import SignatureModal from '../components/SignatureModal';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 48, left: 0, right: 0 }),
}));

// The canvas is a WebView; it has nothing to do with the layout under test.
jest.mock('../components/SignatureCapture', () => {
  const { View } = require('react-native');
  const { forwardRef } = require('react');
  const Stub = forwardRef(() => <View />);
  return { __esModule: true, default: Stub };
});

describe('SignatureModal', () => {
  it('keeps Clear / Confirm above the Android navigation bar (bottom inset)', () => {
    const { getByTestId } = render(
      <SignatureModal visible onClose={jest.fn()} onSave={jest.fn()} />
    );
    const style = StyleSheet.flatten(getByTestId('signature-modal-root').props.style);
    expect(style.paddingBottom).toBe(48);
    expect(style.paddingTop).toBe(24);
  });
});
