/**
 * Vendor Banking Screen
 * Allows vendors to manage their payout preferences:
 * - Bank account details (name, bank, branch, account number)
 * - Payout schedule (instant/daily/weekly)
 * Saves via the save-vendor-payout-preferences Edge Function.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/shared/theme/colors';

const BRAND_BLUE = colors.info[500];  // RSA Blue
const BRAND_GREEN = colors.success[500]; // SA Green

type PayoutSchedule = 'instant' | 'daily' | 'weekly';
type AccountType = 'cheque' | 'savings' | 'transmission';

interface PayoutPreferences {
  schedule: PayoutSchedule;
  bank_account_name: string;
  bank_name: string;
  branch_code: string;
  account_number_masked: string | null;
  account_type: AccountType | null;
}

interface EarningsResponse {
  preferences: {
    schedule: string;
    bank_account_name: string | null;
    bank_name: string | null;
    branch_code: string | null;
    account_type: string | null;
  } | null;
}

const SCHEDULE_OPTIONS: { value: PayoutSchedule; label: string; desc: string; fee: string }[] = [
  { value: 'instant', label: 'Instant', desc: 'Same business day', fee: 'R10 fee' },
  { value: 'daily', label: 'Daily', desc: 'Next business day', fee: 'R5 fee' },
  { value: 'weekly', label: 'Weekly (Free)', desc: 'Every Monday', fee: 'Free' },
];

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'cheque', label: 'Cheque Account' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'transmission', label: 'Transmission Account' },
];

export default function VendorBankingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [schedule, setSchedule] = useState<PayoutSchedule>('weekly');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [hasExistingData, setHasExistingData] = useState(false);

  useEffect(() => {
    loadExistingPreferences();
  }, []);

  const loadExistingPreferences = async () => {
    try {
      const { data: result, error } = await supabase.functions.invoke<EarningsResponse>(
        'get-vendor-earnings',
        { method: 'GET' }
      );

      if (!error && result?.preferences) {
        const prefs = result.preferences;
        setHasExistingData(true);
        setSchedule((prefs.schedule as PayoutSchedule) || 'weekly');
        setBankAccountName(prefs.bank_account_name || '');
        setBankName(prefs.bank_name || '');
        setBranchCode(prefs.branch_code || '');
        setAccountType(prefs.account_type as AccountType | null);
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate
    if (!bankAccountName.trim()) {
      Alert.alert('Required', 'Please enter the bank account holder name.');
      return;
    }
    if (!bankName.trim()) {
      Alert.alert('Required', 'Please enter the bank name.');
      return;
    }
    if (!branchCode.trim()) {
      Alert.alert('Required', 'Please enter the branch code.');
      return;
    }
    if (!accountNumber.trim() && !hasExistingData) {
      Alert.alert('Required', 'Please enter your account number.');
      return;
    }
    if (!accountType) {
      Alert.alert('Required', 'Please select an account type.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        schedule,
        bank_account_name: bankAccountName.trim(),
        bank_name: bankName.trim(),
        branch_code: branchCode.trim(),
        account_type: accountType,
      };

      // Only send account number if it was changed
      if (accountNumber.trim()) {
        payload.account_number = accountNumber.trim();
      }

      const { error } = await supabase.functions.invoke(
        'save-vendor-payout-preferences',
        {
          method: 'POST',
          body: payload,
        }
      );

      if (error) throw new Error(error.message || 'Failed to save preferences');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Your payout preferences have been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const scheduleFeeColor = (s: PayoutSchedule) => {
    switch (s) {
      case 'instant': return colors.error[500];
      case 'daily': return colors.warning[500];
      case 'weekly': return BRAND_GREEN;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_BLUE} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Banking Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Payout Schedule */}
          <Text style={styles.sectionTitle}>Payout Schedule</Text>
          <Text style={styles.sectionSub}>
            Choose how often you receive payouts for completed jobs.
          </Text>

          <View style={styles.scheduleOptions}>
            {SCHEDULE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.scheduleOption,
                  schedule === opt.value && styles.scheduleOptionActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSchedule(opt.value);
                }}
              >
                <Ionicons
                  name={schedule === opt.value ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={schedule === opt.value ? BRAND_BLUE : colors.gray[200]}
                />
                <View style={styles.scheduleTextWrap}>
                  <View style={styles.scheduleLabelRow}>
                    <Text style={[
                      styles.scheduleLabel,
                      schedule === opt.value && styles.scheduleLabelActive,
                    ]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.scheduleFee, { color: scheduleFeeColor(opt.value) }]}>
                      {opt.fee}
                    </Text>
                  </View>
                  <Text style={styles.scheduleDesc}>{opt.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bank Details */}
          <Text style={styles.sectionTitle}>Bank Account Details</Text>
          <Text style={styles.sectionSub}>
            Your bank details are stored securely and used only for payouts.
          </Text>

          {/* Account Holder Name */}
          <Text style={styles.fieldLabel}>Account Holder Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. John Doe / Business Name"
            placeholderTextColor={colors.text.tertiary}
            value={bankAccountName}
            onChangeText={setBankAccountName}
            autoCapitalize="words"
          />

          {/* Bank Name */}
          <Text style={styles.fieldLabel}>Bank Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. First National Bank"
            placeholderTextColor={colors.text.tertiary}
            value={bankName}
            onChangeText={setBankName}
          />

          {/* Branch Code */}
          <Text style={styles.fieldLabel}>Branch Code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 255005"
            placeholderTextColor={colors.text.tertiary}
            value={branchCode}
            onChangeText={setBranchCode}
            keyboardType="number-pad"
            maxLength={10}
          />

          {/* Account Number */}
          <Text style={styles.fieldLabel}>Account Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 62841728093"
            placeholderTextColor={colors.text.tertiary}
            value={accountNumber}
            onChangeText={setAccountNumber}
            keyboardType="number-pad"
            maxLength={20}
            secureTextEntry={false}
          />
          {hasExistingData && !accountNumber && (
            <Text style={styles.fieldHint}>
              Leave blank to keep your existing account number on file.
            </Text>
          )}

          {/* Account Type */}
          <Text style={styles.fieldLabel}>Account Type</Text>
          <View style={styles.accountTypeRow}>
            {ACCOUNT_TYPES.map((at) => (
              <TouchableOpacity
                key={at.value}
                style={[
                  styles.accountTypeOption,
                  accountType === at.value && styles.accountTypeOptionActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setAccountType(at.value);
                }}
              >
                <Text style={[
                  styles.accountTypeText,
                  accountType === at.value && styles.accountTypeTextActive,
                ]}>
                  {at.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark-outline" size={18} color={BRAND_GREEN} />
            <Text style={styles.securityNoteText}>
              Your bank details are encrypted at rest and used only for processing payouts.
              We never share your banking information with third parties.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color={colors.text.inverse} />
              <Text style={styles.saveButtonText}>
                {hasExistingData ? 'Update Preferences' : 'Save Preferences'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  scheduleOptions: {
    gap: 10,
    marginBottom: 24,
  },
  scheduleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colors.background.default,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border.default,
  },
  scheduleOptionActive: {
    borderColor: BRAND_BLUE,
    backgroundColor: colors.info[50],
  },
  scheduleTextWrap: {
    flex: 1,
  },
  scheduleLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  scheduleLabelActive: {
    color: BRAND_BLUE,
  },
  scheduleFee: {
    fontSize: 12,
    fontWeight: '700',
  },
  scheduleDesc: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[700],
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: colors.background.default,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  fieldHint: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  accountTypeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  accountTypeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.background.default,
  },
  accountTypeOptionActive: {
    borderColor: BRAND_BLUE,
    backgroundColor: colors.info[50],
  },
  accountTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  accountTypeTextActive: {
    color: BRAND_BLUE,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.success[50],
    borderRadius: 10,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#C6F6D5',
  },
  securityNoteText: {
    fontSize: 13,
    color: colors.success[700],
    lineHeight: 18,
    flex: 1,
  },
  footer: {
    padding: 16,
    backgroundColor: colors.background.default,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: BRAND_BLUE,
    borderRadius: 12,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.inverse,
  },
});
