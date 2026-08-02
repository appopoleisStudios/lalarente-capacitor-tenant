import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ModalSheet } from './ModalSheet';
import { TextArea } from '../forms/TextArea';

// Stable testIDs so Maestro flows can drive the prompt (native Alert.prompt
// text entry is not scriptable; these make it fully scriptable).
export const REASON_PROMPT_TEST_IDS = {
  input: 'reason-input',
  confirm: 'reason-confirm',
  cancel: 'reason-cancel',
} as const;

export interface ReasonPromptModalProps {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Make the confirm button destructive-red (e.g. Reject). */
  destructive?: boolean;
  /** Require a non-empty reason before confirming. Default: true. */
  required?: boolean;
  submitting?: boolean;
  /** Override the stable testIDs (see REASON_PROMPT_TEST_IDS). */
  testIDs?: {
    input?: string;
    confirm?: string;
    cancel?: string;
  };
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * Bottom-sheet modal that asks the user for a text reason (reject, revision,
 * counter-offer rejection, etc.). Replaces Alert.prompt so both iOS and
 * Android get a consistent, styled input — and it works inside Maestro E2E
 * flows (native Alert.prompt text entry is not scriptable).
 */
export function ReasonPromptModal({
  visible,
  title,
  message,
  placeholder = 'Type your reason...',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  required = true,
  submitting = false,
  testIDs,
  onCancel,
  onConfirm,
}: ReasonPromptModalProps) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  // Reset input each time the modal opens (a fresh prompt shouldn't keep the
  // previous reason).
  useEffect(() => {
    if (visible) {
      setReason('');
      setTouched(false);
    }
  }, [visible]);

  const inputEmpty = required && reason.trim() === '';
  const showError = required && touched && inputEmpty;

  // Button stays pressable (unless submitting) so tapping it on an empty
  // required field surfaces the inline error — matching the old Alert.prompt
  // behavior ("Please provide a reason"). No dimming while empty, so the
  // user can see the button is active and get the validation feedback.
  const handleConfirm = () => {
    setTouched(true);
    if (required && reason.trim() === '') return;
    onConfirm(reason.trim());
  };

  return (
    <ModalSheet visible={visible} onClose={submitting ? () => {} : onCancel} title={title}>
      {message && <Text style={styles.message}>{message}</Text>}

      <TextArea
        testID={testIDs?.input ?? REASON_PROMPT_TEST_IDS.input}
        value={reason}
        onChangeText={setReason}
        placeholder={placeholder}
        maxLength={500}
        showCount
        error={showError ? 'Please provide a reason' : undefined}
        editable={!submitting}
        containerStyle={styles.inputContainer}
      />

      <View style={styles.actions}>
        <TouchableOpacity
          testID={testIDs?.cancel ?? REASON_PROMPT_TEST_IDS.cancel}
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
          disabled={submitting}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID={testIDs?.confirm ?? REASON_PROMPT_TEST_IDS.confirm}
          style={[
            styles.button,
            destructive ? styles.destructiveButton : styles.confirmButton,
            submitting && styles.buttonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={submitting}
          activeOpacity={0.7}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 14,
    color: '#525252',
    lineHeight: 20,
    marginBottom: 14,
  },
  inputContainer: {
    marginBottom: 0,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#404040',
  },
  confirmButton: {
    backgroundColor: '#002395',
  },
  destructiveButton: {
    backgroundColor: '#DE3831',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
