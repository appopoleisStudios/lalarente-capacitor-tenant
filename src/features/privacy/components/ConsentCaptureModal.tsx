/**
 * Consent Capture Modal
 *
 * POPIA s11: Displays consent checkboxes with exact legal wording.
 * Used during signup and when privacy notice is updated.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';
import {
  consentApi,
  REQUIRED_CONSENTS,
  OPTIONAL_CONSENTS,
  type ConsentType,
  type CaptureMethod,
} from '../api';

interface ConsentCaptureModalProps {
  visible: boolean;
  userId: string;
  captureMethod: CaptureMethod;
  onComplete: () => void;
  onDismiss?: () => void;
  showOptional?: boolean;
}

export const ConsentCaptureModal: React.FC<ConsentCaptureModalProps> = ({
  visible,
  userId,
  captureMethod,
  onComplete,
  onDismiss,
  showOptional = true,
}) => {
  const [checkedConsents, setCheckedConsents] = useState<Set<ConsentType>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allRequiredChecked = REQUIRED_CONSENTS.every((c) => checkedConsents.has(c.type));

  const toggleConsent = (type: ConsentType) => {
    setCheckedConsents((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!allRequiredChecked) return;

    setSubmitting(true);
    setError(null);

    try {
      const consentsToCapture = [
        ...REQUIRED_CONSENTS.filter((c) => checkedConsents.has(c.type)).map((c) => ({
          consentType: c.type,
          captureMethod,
          consentText: c.text,
        })),
        ...OPTIONAL_CONSENTS.filter((c) => checkedConsents.has(c.type)).map((c) => ({
          consentType: c.type,
          captureMethod,
          consentText: c.text,
        })),
      ];

      await consentApi.captureMultipleConsents(userId, consentsToCapture);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save consent preferences');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="shield-checkmark" size={28} color={colors.primary[500]} />
            </View>
            <Text style={styles.title}>Your Privacy Matters</Text>
            <Text style={styles.subtitle}>
              In compliance with the Protection of Personal Information Act (POPIA),
              we need your consent to process your data.
            </Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Required Consents */}
            <Text style={styles.sectionTitle}>Required</Text>
            {REQUIRED_CONSENTS.map((consent) => (
              <TouchableOpacity
                key={consent.type}
                style={styles.consentRow}
                onPress={() => toggleConsent(consent.type)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox,
                  checkedConsents.has(consent.type) && styles.checkboxChecked,
                ]}>
                  {checkedConsents.has(consent.type) && (
                    <Ionicons name="checkmark" size={16} color={colors.background.default} />
                  )}
                </View>
                <Text style={styles.consentText}>{consent.text}</Text>
              </TouchableOpacity>
            ))}

            {/* Optional Consents */}
            {showOptional && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Optional</Text>
                {OPTIONAL_CONSENTS.map((consent) => (
                  <TouchableOpacity
                    key={consent.type}
                    style={styles.consentRow}
                    onPress={() => toggleConsent(consent.type)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.checkbox,
                      checkedConsents.has(consent.type) && styles.checkboxChecked,
                    ]}>
                      {checkedConsents.has(consent.type) && (
                        <Ionicons name="checkmark" size={16} color={colors.background.default} />
                      )}
                    </View>
                    <View style={styles.consentTextContainer}>
                      <Text style={styles.consentText}>{consent.text}</Text>
                      <Text style={styles.consentDescription}>{consent.description}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {onDismiss && (
              <TouchableOpacity style={styles.secondaryButton} onPress={onDismiss}>
                <Text style={styles.secondaryButtonText}>Later</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                !allRequiredChecked && styles.primaryButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!allRequiredChecked || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.text.inverse} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {allRequiredChecked ? 'Continue' : 'Please accept required consents'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.background.default,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 34,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  content: {
    paddingHorizontal: 24,
    maxHeight: 400,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.gray[300],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  consentTextContainer: {
    flex: 1,
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  consentDescription: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 4,
    lineHeight: 16,
  },
  errorContainer: {
    marginHorizontal: 24,
    marginTop: 8,
    padding: 12,
    backgroundColor: colors.error[50],
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    color: colors.error[500],
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  primaryButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.inverse,
  },
});
