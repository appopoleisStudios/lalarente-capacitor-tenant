import React, { useState } from 'react';
import {
  Modal,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

/** Local calendar date as YYYY-MM-DD (not toISOString, which shifts the day in UTC+ zones). */
export const toDateString = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseDateString = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
};

export interface DateFieldProps {
  /** YYYY-MM-DD, or '' when unset */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Date the picker opens on when value is empty (defaults to today, clamped to min/max) */
  initialDate?: Date;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  placeholderTextColor?: string;
  /** Field gets testID; iOS picker buttons get `${testID}-done` / `${testID}-cancel` */
  testID?: string;
}

/**
 * Date input that opens the native date picker instead of free typing.
 * iOS: wheel in a bottom sheet with Cancel / Done. Android: system dialog.
 */
export function DateField({
  value,
  onChange,
  placeholder = 'Select date',
  minimumDate,
  maximumDate,
  initialDate,
  disabled,
  style,
  textStyle,
  placeholderTextColor = '#9ca3af',
  testID,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const startDate = () => {
    let d = parseDateString(value) || initialDate || new Date();
    if (minimumDate && d < minimumDate) d = minimumDate;
    if (maximumDate && d > maximumDate) d = maximumDate;
    return d;
  };
  const [draft, setDraft] = useState<Date>(startDate);

  const show = () => {
    if (disabled) return;
    setDraft(startDate());
    setOpen(true);
  };

  return (
    <>
      <TouchableOpacity
        style={style}
        onPress={show}
        activeOpacity={disabled ? 1 : 0.7}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={value ? `Date ${value}` : placeholder}
      >
        <Text style={[textStyle, !value && { color: placeholderTextColor }]}>
          {value || placeholder}
        </Text>
      </TouchableOpacity>

      {open && Platform.OS === 'android' && (
        <DateTimePicker
          value={draft}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, date) => {
            setOpen(false);
            if (event.type === 'set' && date) onChange(toDateString(date));
          }}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.toolbar}>
                <TouchableOpacity
                  onPress={() => setOpen(false)}
                  testID={testID && `${testID}-cancel`}
                >
                  <Text style={styles.cancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setOpen(false);
                    onChange(toDateString(draft));
                  }}
                  testID={testID && `${testID}-done`}
                >
                  <Text style={styles.done}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={(_, date) => date && setDraft(date)}
                themeVariant="light"
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: '#fff',
    paddingBottom: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  cancel: { fontSize: 16, color: '#6b7280' },
  done: { fontSize: 16, fontWeight: '600', color: '#002395' },
});
