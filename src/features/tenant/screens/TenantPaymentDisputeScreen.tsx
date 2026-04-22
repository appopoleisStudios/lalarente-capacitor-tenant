/**
 * Tenant Payment Dispute Screen
 *
 * Allows tenants to raise and track payment disputes.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';
import { supabase } from '@/src/lib/supabase';
import {
  paymentDisputesApi,
  type PaymentDispute,
  type DisputeReason,
} from '@/src/features/payments/api/paymentDisputes.api';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';

const DISPUTE_REASONS: { value: DisputeReason; label: string; icon: string }[] = [
  { value: 'incorrect_amount', label: 'Incorrect Amount', icon: 'calculator-outline' },
  { value: 'already_paid', label: 'Already Paid', icon: 'checkmark-done-outline' },
  { value: 'unauthorized_charge', label: 'Unauthorized Charge', icon: 'lock-closed-outline' },
  { value: 'service_issue', label: 'Service Not Rendered', icon: 'construct-outline' },
  { value: 'calculation_error', label: 'Calculation Error', icon: 'trending-up-outline' },
  { value: 'other', label: 'Other', icon: 'help-circle-outline' },
];

export default function TenantPaymentDisputeScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<PaymentDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedReason, setSelectedReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState('');
  const [disputedAmount, setDisputedAmount] = useState('');

  useEffect(() => {
    initUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userId) fetchDisputes(userId);
    }, [userId])
  );

  const initUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      fetchDisputes(user.id);
    }
  };

  const fetchDisputes = async (uid: string) => {
    try {
      setLoading(true);
      const data = await paymentDisputesApi.getUserDisputes(uid);
      setDisputes(data);
    } catch (err) {
      console.error('Error fetching disputes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDispute = async () => {
    if (!userId || !selectedReason || !description || !disputedAmount) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    const amount = parseFloat(disputedAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid disputed amount.');
      return;
    }

    setSubmitting(true);
    try {
      // Get the latest pending payment to attach the dispute to
      const { data: payments } = await supabase
        .from('payments')
        .select('id, lease_id')
        .eq('tenant_id', userId)
        .eq('status', 'pending')
        .order('due_date', { ascending: true })
        .limit(1);

      if (!payments || payments.length === 0) {
        Alert.alert('No Pending Payment', 'There are no pending payments to dispute.');
        setSubmitting(false);
        return;
      }

      await paymentDisputesApi.raiseDispute(userId, {
        paymentId: payments[0].id,
        leaseId: payments[0].lease_id,
        reason: selectedReason,
        description,
        disputedAmount: amount,
      });

      Alert.alert('Dispute Submitted', 'Your payment dispute has been submitted for review.');
      setShowForm(false);
      setSelectedReason(null);
      setDescription('');
      setDisputedAmount('');
      fetchDisputes(userId);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit dispute');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'open': return { color: colors.warning[500], label: 'Open' };
      case 'under_review': return { color: colors.info[500], label: 'Under Review' };
      case 'mediation': return { color: '#8E44AD', label: 'In Mediation' };
      case 'resolved': return { color: colors.success[500], label: 'Resolved' };
      case 'rejected': return { color: colors.error[500], label: 'Rejected' };
      case 'escalated': return { color: colors.error[600], label: 'Escalated' };
      default: return { color: colors.gray[500], label: status };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate('/(tenant)/payments')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Disputes</Text>
        <TouchableOpacity onPress={() => setShowForm(!showForm)}>
          <Ionicons name={showForm ? 'close' : 'add-circle-outline'} size={28} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* New Dispute Form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Raise a Dispute</Text>

            {/* Reason Selection */}
            <Text style={styles.formLabel}>Reason</Text>
            <View style={styles.reasonGrid}>
              {DISPUTE_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  style={[
                    styles.reasonChip,
                    selectedReason === reason.value && styles.reasonChipSelected,
                  ]}
                  onPress={() => setSelectedReason(reason.value)}
                >
                  <Ionicons
                    name={reason.icon as any}
                    size={16}
                    color={selectedReason === reason.value ? colors.text.inverse : colors.text.secondary}
                  />
                  <Text style={[
                    styles.reasonChipText,
                    selectedReason === reason.value && styles.reasonChipTextSelected,
                  ]}>
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Disputed Amount */}
            <Text style={styles.formLabel}>Disputed Amount (R)</Text>
            <TextInput
              style={styles.input}
              value={disputedAmount}
              onChangeText={setDisputedAmount}
              placeholder="0.00"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="decimal-pad"
            />

            {/* Description */}
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue in detail..."
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              style={[styles.submitButton, (!selectedReason || !description || !disputedAmount) && styles.submitButtonDisabled]}
              onPress={handleSubmitDispute}
              disabled={submitting || !selectedReason || !description || !disputedAmount}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.text.inverse} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Dispute</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Disputes List */}
        {disputes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.gray[300]} />
            <Text style={styles.emptyText}>No disputes</Text>
            <Text style={styles.emptySubtext}>Tap + to raise a new payment dispute</Text>
          </View>
        ) : (
          disputes.map((dispute) => {
            const statusConfig = getStatusConfig(dispute.status);
            return (
              <View key={dispute.id} style={styles.disputeCard}>
                <View style={styles.disputeHeader}>
                  <Text style={styles.disputeReason}>
                    {dispute.reason.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                  </View>
                </View>
                <Text style={styles.disputeDescription} numberOfLines={2}>
                  {dispute.description}
                </Text>
                <View style={styles.disputeFooter}>
                  <Text style={styles.disputeAmount}>R{dispute.disputed_amount.toFixed(2)}</Text>
                  <Text style={styles.disputeDate}>
                    {new Date(dispute.created_at).toLocaleDateString('en-ZA')}
                  </Text>
                </View>
                {dispute.resolution_notes && (
                  <View style={styles.resolutionBox}>
                    <Text style={styles.resolutionLabel}>Resolution:</Text>
                    <Text style={styles.resolutionText}>{dispute.resolution_notes}</Text>
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  formCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 6,
    marginTop: 12,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: 4,
  },
  reasonChipSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  reasonChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  reasonChipTextSelected: {
    color: colors.text.inverse,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text.primary,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  disputeCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  disputeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  disputeReason: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  disputeDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  disputeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  disputeAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.error[500],
  },
  disputeDate: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  resolutionBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: colors.success[50],
    borderRadius: 8,
  },
  resolutionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success[600],
    marginBottom: 2,
  },
  resolutionText: {
    fontSize: 13,
    color: colors.success[700],
  },
});
