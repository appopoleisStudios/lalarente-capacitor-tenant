import React from 'react';
import { render } from '@testing-library/react-native';
import { FocusedStatusBar } from '../FocusedStatusBar';

const mockStatusBar = jest.fn((_props: { style: string }) => null);
jest.mock('expo-status-bar', () => ({
  StatusBar: (props: { style: string }) => mockStatusBar(props),
}));

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));

describe('FocusedStatusBar (CT7-049)', () => {
  beforeEach(() => mockStatusBar.mockClear());

  it('sets the override style while the screen is focused', () => {
    mockFocused = true;
    render(<FocusedStatusBar style="light" />);
    expect(mockStatusBar).toHaveBeenCalledWith({ style: 'light' });
  });

  it('drops the override when the screen loses focus, so the app-wide dark icons return', () => {
    mockFocused = true;
    const { rerender } = render(<FocusedStatusBar style="light" />);
    mockStatusBar.mockClear();
    mockFocused = false;
    rerender(<FocusedStatusBar style="light" />);
    expect(mockStatusBar).not.toHaveBeenCalled();
  });
});
