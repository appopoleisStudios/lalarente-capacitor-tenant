/**
 * CT7-053: Android alerts drop every button after the third. showChoices lists
 * all of them in a sheet on Android, and is a plain Alert.alert otherwise.
 */
import React from 'react';
import { Alert, Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ChoiceSheetHost, showChoices } from '../ChoiceSheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const realOS = Platform.OS;
const setOS = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

function fourButtons() {
  const fns = { cancel: jest.fn(), a: jest.fn(), b: jest.fn(), c: jest.fn() };
  const buttons = [
    { text: 'Cancel', style: 'cancel' as const, onPress: fns.cancel },
    { text: 'Select Specific Vendors', onPress: fns.a },
    { text: 'Open Market', onPress: fns.b },
    { text: 'Dedicated Vendors', onPress: fns.c },
  ];
  return { fns, buttons };
}

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  setOS('android');
});
afterEach(() => {
  jest.restoreAllMocks();
  setOS(realOS);
});

describe('showChoices (CT7-053)', () => {
  it('on Android lists every one of four choices, and the picked one runs', () => {
    const { fns, buttons } = fourButtons();
    const ui = render(<ChoiceSheetHost />);
    act(() => showChoices('Push to Vendors', 'How would you like to route this request?', buttons));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(ui.getByText('Select Specific Vendors')).toBeTruthy();
    expect(ui.getByText('Open Market')).toBeTruthy();
    expect(ui.getByText('Dedicated Vendors')).toBeTruthy();
    expect(ui.getByText('How would you like to route this request?')).toBeTruthy();
    fireEvent.press(ui.getByText('Dedicated Vendors'));
    expect(fns.c).toHaveBeenCalledTimes(1);
    expect(fns.cancel).not.toHaveBeenCalled();
    expect(ui.queryByText('Dedicated Vendors')).toBeNull();
  });

  it('Cancel, and closing the sheet, run the cancel button', () => {
    const { fns, buttons } = fourButtons();
    const ui = render(<ChoiceSheetHost />);
    act(() => showChoices('t', undefined, buttons));
    fireEvent.press(ui.getByTestId('choice-sheet-cancel'));
    expect(fns.cancel).toHaveBeenCalledTimes(1);

    act(() => showChoices('t', undefined, buttons));
    fireEvent(ui.UNSAFE_getByType(require('react-native').Modal), 'requestClose'); // Android Back
    expect(fns.cancel).toHaveBeenCalledTimes(2);
    expect(ui.queryByTestId('choice-sheet-cancel')).toBeNull();
  });

  it('three buttons or fewer stay a native alert on Android', () => {
    const buttons = fourButtons().buttons.slice(0, 3);
    render(<ChoiceSheetHost />);
    showChoices('t', 'm', buttons);
    expect(alertSpy).toHaveBeenCalledWith('t', 'm', buttons);
  });

  it('iOS keeps the native alert (it shows any number of buttons)', () => {
    setOS('ios');
    const { buttons } = fourButtons();
    render(<ChoiceSheetHost />);
    showChoices('t', 'm', buttons);
    expect(alertSpy).toHaveBeenCalledWith('t', 'm', buttons);
  });
});
