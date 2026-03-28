/**
 * Tenant Early Termination Screen
 *
 * Shows termination estimate (penalty, notice period) and allows
 * tenant to submit an early termination request.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';
import { supabase } from '@/src/lib/supabase';
import {
  leaseTerminationApi,
  type TerminationEstimate,
} from '@/src/features/leases/api/leaseTermination.api';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';

export default function TenantEarlyTerminationScreen() {
  const router = useRouter();
  const { leaseId } = useLocalSearchParams<{ leaseId: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<TerminationEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);

    if (leaseId) {
      try {
        const est = await leaseTerminationApi.calculateTerminationPenalty(leaseId);
        setEstimate(est);

        // Check if termination was already requested
        const { data: lease } = await supabase
          .from('leases')
          .select('early_termination_requested_at')
          .eq('id', leaseId)
          .single();
        if (lease?.early_termination_requested_at) {
          setSubmitted(true);
        }
      } catch (err) {
        console.error('Error calculating estimate:', err);
      }
    }
    setLoading(false);
  };

  const handleSubmit = () => {
    if (!userId || !leaseId || !estimate) return;

    Alert.alert(
      'Confirm Early Termination',
      `You will be charged a penalty of R${estimate.penaltyAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}. The termination will take effect on ${estimate.effectiveDate}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Request',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await leaseTerminationApi.requestTermination({
                leaseId,
                requestedBy: userId,
                reason: reason || 'Tenant requested early termination',
                requestedEffectiveDate: estimate.effectiveDate,
              });
              setSubmitted(true);
              Alert.alert(
                'Request Submitted',
                'Your early termination request has been submitted. Your landlord will be notified.',
                [{ text: 'OK', onPress: () => router.navigate('/(tenant)/lease') }]
              );
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit request');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!estimate) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.navigate('/(tenant)/lease')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Early Termination</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Unable to calculate termination estimate</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate('/(tenant)/lease')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Early Termination</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Warning Banner */}
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={24} color={colors.warning[600]} />
          <Text style={styles.warningText}>
            Early termination will incur a penalty. Please review the estimate below carefully.
          </Text>
        </View>

        {/* Estimate Card */}
        <View style={styles.estimateCard}>
          <Text style={styles.estimateTitle}>Termination Estimate</Text>

          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Monthly Rent</Text>
            <Text style={styles.estimateValue}>R{estimate.monthlyRent.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</Text>
          </View>

          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Remaining Months</Text>
            <Text style={styles.estimateValue}>{estimate.remainingMonths}</Text>
          </View>

          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Notice Period</Text>
            <Text style={styles.estimateValue}>{estimate.noticePeriodDays} days</Text>
          </View>

          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Effective Date</Text>
            <Text style={styles.estimateValue}>{estimate.effectiveDate}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.estimateRow}>
            <Text style={[styles.estimateLabel, styles.penaltyLabel]}>Termination Penalty</Text>
            <Text style={styles.penaltyValue}>
              R{estimate.penaltyAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          <Text style={styles.penaltyNote}>
            Capped at 2 months rent per CPA reasonable penalty guidelines
          </Text>

          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Deposit Refund Estimate</Text>
            <Text style={[styles.estimateValue, { color: colors.success[500] }]}>
              R{estimate.depositRefundEstimate.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Reason */}
        <Text style={styles.formLabel}>Reason for termination (optional)</Text>
        <TextInput
          style={styles.input}
          value={reason}
          onChangeText={setReason}
          placeholder="e.g., Relocating for work, financial reasons..."
          placeholderTextColor={colors.text.tertiary}
          multiline
          numberOfLines={3}
        />

        {/* Submit / Submitted State */}
        {submitted ? (
          <View style={styles.submittedBanner}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success[500]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.submittedTitle}>Request Pending</Text>
              <Text style={styles.submittedDesc}>Your landlord has been notified and will respond soon.</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.text.inverse} />
            ) : (
              <Text style={styles.submitButtonText}>Submit Termination Request</Text>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  content: { flex: 1, padding: 16 },
  warningBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.warning[50], padding: 16, borderRadius: 12, gap: 12, marginBottom: 20,
  },
  warningText: { flex: 1, fontSize: 14, color: colors.warning[700], lineHeight: 20 },
  estimateCard: {
    backgroundColor: colors.background.default, borderRadius: 12, padding: 20, marginBottom: 20,
  },
  estimateTitle: { fontSize: 17, fontWeight: '700', color: colors.text.primary, marginBottom: 16 },
  estimateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8,
  },
  estimateLabel: { fontSize: 14, color: colors.text.secondary },
  estimateValue: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  divider: {
    height: 1, backgroundColor: colors.border.default, marginVertical: 8,
  },
  penaltyLabel: { fontWeight: '700', color: colors.error[500] },
  penaltyValue: { fontSize: 20, fontWeight: '700', color: colors.error[500] },
  penaltyNote: { fontSize: 11, color: colors.text.tertiary, marginBottom: 8 },
  formLabel: {
    fontSize: 13, fontWeight: '600', color: colors.text.secondary, marginBottom: 6,
  },
  input: {
    borderWidth: 1, borderColor: colors.border.default, borderRadius: 12,
    padding: 14, fontSize: 14, color: colors.text.primary,
    backgroundColor: colors.background.default, minHeight: 80, textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: colors.error[500], paddingVertical: 16, borderRadius: 12, alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: colors.text.inverse },
  submittedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.success[50], borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: colors.success[600],
  },
  submittedTitle: { fontSize: 15, fontWeight: '700', color: colors.success[700] },
  submittedDesc: { fontSize: 13, color: colors.success[600], marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: colors.text.tertiary },
});
