import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { AlertButton } from 'react-native';
import { ModalSheet } from './ModalSheet';

/**
 * Android alerts show at most three buttons and drop the rest (React Native
 * keeps `buttons.slice(0, 3)`), and they cannot be dismissed with Back. A
 * fourth choice silently vanished (CT7-053): "Dedicated Vendors" on Push to
 * Vendors, "5 Years" on Extend Retention, half the country codes, and the
 * Cancel button of several pickers, leaving the user no way out.
 *
 * `showChoices` takes the same arguments as `Alert.alert`. On iOS, or with
 * three buttons or fewer, it is `Alert.alert`. On Android with more, it shows
 * every button in a bottom sheet; closing the sheet runs the cancel button.
 */
export const MAX_ANDROID_ALERT_BUTTONS = 3;

type Request = { title: string; message?: string; buttons: AlertButton[] };
let present: ((request: Request) => void) | null = null;

export function showChoices(title: string, message: string | undefined, buttons: AlertButton[]) {
  if (Platform.OS !== 'android' || buttons.length <= MAX_ANDROID_ALERT_BUTTONS || !present) {
    Alert.alert(title, message, buttons);
    return;
  }
  present({ title, message, buttons });
}

/** Mounted once in the root layout. */
export function ChoiceSheetHost() {
  const [request, setRequest] = useState<Request | null>(null);

  useEffect(() => {
    present = setRequest;
    return () => {
      if (present === setRequest) present = null;
    };
  }, []);

  if (!request) return null;
  const cancel = request.buttons.find((b) => b.style === 'cancel');
  const choices = request.buttons.filter((b) => b !== cancel);

  const choose = (button?: AlertButton) => {
    setRequest(null);
    button?.onPress?.();
  };

  return (
    <ModalSheet visible title={request.title} onClose={() => choose(cancel)}>
      {request.message ? <Text style={styles.message}>{request.message}</Text> : null}
      {choices.map((button, index) => (
        <TouchableOpacity
          key={`${index}-${button.text}`}
          testID={`choice-sheet-option-${index}`}
          accessibilityRole="button"
          style={styles.row}
          onPress={() => choose(button)}
        >
          <Text style={[styles.text, button.style === 'destructive' && styles.destructive]}>
            {button.text}
          </Text>
        </TouchableOpacity>
      ))}
      {cancel ? (
        <TouchableOpacity
          testID="choice-sheet-cancel"
          accessibilityRole="button"
          style={[styles.row, styles.cancelRow]}
          onPress={() => choose(cancel)}
        >
          <Text style={[styles.text, styles.cancelText]}>{cancel.text ?? 'Cancel'}</Text>
        </TouchableOpacity>
      ) : null}
      <View style={styles.spacer} />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  message: { fontSize: 14, color: '#525252', marginBottom: 8 },
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  text: { fontSize: 16, color: '#171717' },
  destructive: { color: '#DC2626' },
  cancelRow: { borderBottomWidth: 0, marginTop: 4 },
  cancelText: { color: '#525252', fontWeight: '600' },
  spacer: { height: 8 },
});
