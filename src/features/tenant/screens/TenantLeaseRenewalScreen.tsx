/**
 * Tenant Lease Renewal Screen
 *
 * CPA s14(2)(c): Landlord must notify tenant 80/60/40 business days before
 * fixed-term lease expires. Tenant has the right to renew, terminate, or negotiate.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import { leaseExpiryApi, LeaseExpiryInfo } from '@/src/features/leases/api/leaseExpiry.api';
import { leaseRenewalApi, RenewalNegotiation } from '@/src/features/leases/api/leaseRenewal.api';
import { colors } from '@/src/shared/theme/colors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatZAR = (amount: number) =>
  `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const NEGOTIATION_STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Awaiting Your Response', color: '#D97706', bg: '#FEF3C7' },
  accepted: { label: 'Accepted', color: colors.rsa.green, bg: '#E6F7F0' },
  counter_offer: { label: 'Counter-Offer Sent', color: colors.rsa.blue, bg: '#E6EBF5' },
  rejected: { label: 'Rejected', color: colors.rsa.red, bg: '#FEF2F2' },
  expired: { label: 'Expired', color: '#6B7280', bg: '#F3F4F6' },
  withdrawn: { label: 'Withdrawn', color: '#6B7280', bg: '#F3F4F6' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TenantLeaseRenewalScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leaseId, setLeaseId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [monthlyRent, setMonthlyRent] = useState(0);
  const [propertyTitle, setPropertyTitle] = useState('');
  const [leaseEndDate, setLeaseEndDate] = useState('');
  const [expiryInfo, setExpiryInfo] = useState<LeaseExpiryInfo | null>(null);
  const [latestNegotiation, setLatestNegotiation] = useState<RenewalNegotiation | null>(null);
  const [negotiations, setNegotiations] = useState<RenewalNegotiation[]>([]);
  const [responseMode, setResponseMode] = useState<'none' | 'negotiate'>('none');
  const [counterRent, setCounterRent] = useState('');
  const [counterNotes, setCounterNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadLeaseRenewal();
    }, [])
  );

  const loadLeaseRenewal = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: lease, error } = await supabase
        .from('leases')
        .select(`
          id, monthly_rent, end_date, lease_type,
          property:properties!property_id(title)
        `)
        .eq('tenant_id', user.id)
        .in('status', ['active', 'renewal_pending'])
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!lease) {
        setLoading(false);
        return;
      }

      setLeaseId(lease.id);
      setMonthlyRent(lease.monthly_rent || 0);
      setLeaseEndDate(lease.end_date);
      setPropertyTitle((lease.property as any)?.title || 'Your Property');

      // Load expiry info and negotiations in parallel
      const [expiry, history] = await Promise.all([
        leaseExpiryApi.getLeaseExpiryInfo(lease.id),
        leaseRenewalApi.getNegotiationHistory(lease.id),
      ]);

      setExpiryInfo(expiry);
      setNegotiations(history);

      const latest = history.length > 0 ? history[history.length - 1] : null;
      setLatestNegotiation(latest);

      // If there's a pending offer from the owner, pre-fill counter rent
      if (latest && latest.status === 'pending' && latest.initiated_by !== user.id) {
        setCounterRent(latest.proposed_monthly_rent.toString());
      }
    } catch (err: any) {
      console.error('Error loading lease renewal:', err);
      Alert.alert('Error', 'Failed to load renewal information');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordResponse = async (response: 'renew' | 'terminate' | 'negotiate') => {
    if (!leaseId) return;

    const messages = {
      renew: 'Confirm you want to renew this lease?',
      terminate: 'Confirm you do not wish to renew — the lease will end on the stated date.',
      negotiate: null,
    };

    if (response === 'negotiate') {
      setResponseMode('negotiate');
      return;
    }

    Alert.alert(
      response === 'renew' ? 'Renew Lease' : 'Decline Renewal',
      messages[response]!,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true);
            try {
              await leaseExpiryApi.recordTenantResponse(leaseId, response);
              Alert.alert(
                'Response Recorded',
                response === 'renew'
                  ? 'Your landlord has been notified you wish to renew.'
                  : 'Your landlord has been notified you will not be renewing.'
              );
              loadLeaseRenewal();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to record response');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleAcceptOffer = async () => {
    if (!latestNegotiation || !userId) return;
    setSubmitting(true);
    try {
      await leaseRenewalApi.acceptRenewal(latestNegotiation.id, userId, 'Accepted by tenant');
      Alert.alert(
        'Offer Accepted',
        'Your landlord has been notified. A new lease agreement will be prepared.',
        [{ text: 'OK', onPress: () => loadLeaseRenewal() }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to accept offer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectOffer = async () => {
    if (!latestNegotiation) return;
    setSubmitting(true);
    try {
      await leaseRenewalApi.rejectRenewal(latestNegotiation.id, 'Rejected by tenant');
      Alert.alert('Offer Rejected', 'The landlord has been notified.');
      loadLeaseRenewal();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reject offer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitCounter = async () => {
    if (!leaseId || !userId || !latestNegotiation) return;
    const rentNum = parseFloat(counterRent);
    if (isNaN(rentNum) || rentNum < 100) {
      Alert.alert('Invalid Rent', 'Please enter a valid monthly rent amount');
      return;
    }

    setSubmitting(true);
    try {
      await leaseRenewalApi.counterOffer(
        latestNegotiation.id,
        userId,
        {
          leaseId,
          proposedRent: rentNum,
          leaseType: latestNegotiation.proposed_lease_type,
          durationMonths: latestNegotiation.proposed_duration_months || undefined,
          startDate: latestNegotiation.proposed_start_date,
          escalationRate: latestNegotiation.proposed_escalation_rate || undefined,
          notes: counterNotes.trim() || undefined,
        }
      );
      Alert.alert('Counter-Offer Sent', 'Your landlord will review your proposal.');
      setResponseMode('none');
      loadLeaseRenewal();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send counter-offer');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Lease Renewal</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.rsa.green} />
        </View>
      </SafeAreaView>
    );
  }

  if (!expiryInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Lease Renewal</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="document-text-outline" size={64} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Active Lease</Text>
          <Text style={styles.emptySubtitle}>Renewal options will appear when you have an active lease</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pendingOwnerOffer = latestNegotiation &&
    latestNegotiation.status === 'pending' &&
    latestNegotiation.initiated_by !== userId;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Lease Renewal</Text>
          <Text style={styles.subtitle}>{propertyTitle}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Expiry Countdown */}
        <View style={[
          styles.expiryCard,
          expiryInfo.daysUntilExpiry <= 40 && { borderColor: colors.rsa.red, borderWidth: 2 },
          expiryInfo.daysUntilExpiry <= 60 && expiryInfo.daysUntilExpiry > 40 && { borderColor: '#F59E0B', borderWidth: 2 },
        ]}>
          <View style={styles.expiryTop}>
            <Ionicons
              name="calendar"
              size={28}
              color={expiryInfo.daysUntilExpiry <= 40 ? colors.rsa.red : colors.rsa.green}
            />
            <View style={styles.expiryText}>
              <Text style={styles.expiryDays}>
                {expiryInfo.daysUntilExpiry > 0
                  ? `${expiryInfo.daysUntilExpiry} days`
                  : 'EXPIRED'}
              </Text>
              <Text style={styles.expiryLabel}>
                until lease expires on {new Date(leaseEndDate).toLocaleDateString('en-ZA')}
              </Text>
            </View>
          </View>
          <View style={styles.rentRow}>
            <Text style={styles.rentLabel}>Current rent</Text>
            <Text style={styles.rentAmount}>{formatZAR(monthlyRent)}/mo</Text>
          </View>
        </View>

        {/* CPA Notice Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CPA Notice Timeline</Text>
          <Text style={styles.sectionSubtitle}>
            Your landlord is legally required to notify you at these milestones (CPA s14(2)(c))
          </Text>
          {[
            { label: '80 business days', date: expiryInfo.notice80Due, sent: expiryInfo.notice80Sent },
            { label: '60 business days', date: expiryInfo.notice60Due, sent: expiryInfo.notice60Sent },
            { label: '40 business days', date: expiryInfo.notice40Due, sent: expiryInfo.notice40Sent },
          ].map((notice, i) => (
            <View key={i} style={styles.noticeRow}>
              <Ionicons
                name={notice.sent ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={notice.sent ? colors.rsa.green : colors.gray[300]}
              />
              <View style={styles.noticeInfo}>
                <Text style={styles.noticeLabel}>Notice at {notice.label}</Text>
                <Text style={styles.noticeDate}>
                  Due: {new Date(notice.date).toLocaleDateString('en-ZA')}
                </Text>
              </View>
              {notice.sent && (
                <View style={styles.sentBadge}>
                  <Text style={styles.sentBadgeText}>Sent</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Active Offer from Owner */}
        {pendingOwnerOffer && responseMode === 'none' && (
          <View style={styles.offerCard}>
            <View style={styles.offerHeader}>
              <Ionicons name="mail" size={22} color={colors.rsa.blue} />
              <Text style={styles.offerTitle}>Renewal Offer from Your Landlord</Text>
            </View>
            <View style={styles.offerTerms}>
              <View style={styles.offerRow}>
                <Text style={styles.offerLabel}>Proposed Rent</Text>
                <Text style={styles.offerValue}>
                  {formatZAR(latestNegotiation!.proposed_monthly_rent)}/mo
                </Text>
              </View>
              <View style={styles.offerRow}>
                <Text style={styles.offerLabel}>Lease Type</Text>
                <Text style={styles.offerValue}>
                  {latestNegotiation!.proposed_lease_type === 'fixed'
                    ? `Fixed ${latestNegotiation!.proposed_duration_months}mo`
                    : 'Month-to-Month'}
                </Text>
              </View>
              <View style={styles.offerRow}>
                <Text style={styles.offerLabel}>Start Date</Text>
                <Text style={styles.offerValue}>
                  {new Date(latestNegotiation!.proposed_start_date).toLocaleDateString('en-ZA')}
                </Text>
              </View>
              {latestNegotiation!.proposed_terms_notes && (
                <Text style={styles.offerNotes}>{latestNegotiation!.proposed_terms_notes}</Text>
              )}
            </View>
            {latestNegotiation!.response_deadline && (
              <Text style={styles.deadlineText}>
                Respond by: {new Date(latestNegotiation!.response_deadline).toLocaleDateString('en-ZA')}
              </Text>
            )}
            <View style={styles.offerActions}>
              <TouchableOpacity
                style={[styles.offerAction, styles.acceptAction]}
                onPress={handleAcceptOffer}
                disabled={submitting}
              >
                <Ionicons name="checkmark" size={18} color={colors.rsa.white} />
                <Text style={styles.offerActionText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.offerAction, styles.counterAction]}
                onPress={() => setResponseMode('negotiate')}
                disabled={submitting}
              >
                <Ionicons name="swap-horizontal" size={18} color={colors.rsa.blue} />
                <Text style={[styles.offerActionText, { color: colors.rsa.blue }]}>Counter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.offerAction, styles.rejectAction]}
                onPress={handleRejectOffer}
                disabled={submitting}
              >
                <Ionicons name="close" size={18} color={colors.rsa.red} />
                <Text style={[styles.offerActionText, { color: colors.rsa.red }]}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Counter-Offer Form */}
        {responseMode === 'negotiate' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Submit Counter-Offer</Text>
            <Text style={styles.fieldLabel}>Your Proposed Monthly Rent *</Text>
            <TextInput
              style={styles.input}
              value={counterRent}
              onChangeText={setCounterRent}
              placeholder="e.g. 8500"
              placeholderTextColor={colors.gray[400]}
              keyboardType="numeric"
            />
            <Text style={styles.fieldLabel}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={counterNotes}
              onChangeText={setCounterNotes}
              placeholder="Reason for counter-offer..."
              placeholderTextColor={colors.gray[400]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formAction, styles.formActionSecondary]}
                onPress={() => setResponseMode('none')}
              >
                <Text style={styles.formActionSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formAction, styles.formActionPrimary]}
                onPress={handleSubmitCounter}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.rsa.white} />
                ) : (
                  <Text style={styles.formActionPrimaryText}>Send Counter-Offer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Your Response Options (no active offer) */}
        {!pendingOwnerOffer && responseMode === 'none' && !expiryInfo.tenantResponse && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Intention</Text>
            <Text style={styles.sectionSubtitle}>
              Let your landlord know your plans for when the lease expires
            </Text>
            <View style={styles.responseOptions}>
              <TouchableOpacity
                style={[styles.responseOption, { borderColor: colors.rsa.green }]}
                onPress={() => handleRecordResponse('renew')}
                disabled={submitting}
              >
                <Ionicons name="refresh-circle" size={28} color={colors.rsa.green} />
                <Text style={[styles.responseOptionTitle, { color: colors.rsa.green }]}>Renew Lease</Text>
                <Text style={styles.responseOptionDesc}>I want to stay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.responseOption, { borderColor: '#D97706' }]}
                onPress={() => handleRecordResponse('negotiate')}
                disabled={submitting}
              >
                <Ionicons name="chatbubbles" size={28} color="#D97706" />
                <Text style={[styles.responseOptionTitle, { color: '#D97706' }]}>Negotiate</Text>
                <Text style={styles.responseOptionDesc}>Discuss new terms</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.responseOption, { borderColor: colors.rsa.red }]}
                onPress={() => handleRecordResponse('terminate')}
                disabled={submitting}
              >
                <Ionicons name="exit" size={28} color={colors.rsa.red} />
                <Text style={[styles.responseOptionTitle, { color: colors.rsa.red }]}>Not Renewing</Text>
                <Text style={styles.responseOptionDesc}>I will be leaving</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recorded Response */}
        {expiryInfo.tenantResponse && !pendingOwnerOffer && (
          <View style={[styles.section, { borderLeftWidth: 4, borderLeftColor: colors.rsa.green }]}>
            <Text style={styles.sectionTitle}>Your Recorded Response</Text>
            <Text style={styles.recordedResponse}>
              {expiryInfo.tenantResponse === 'renew' && 'You have indicated you wish to renew your lease.'}
              {expiryInfo.tenantResponse === 'terminate' && 'You have indicated you will not be renewing.'}
              {expiryInfo.tenantResponse === 'negotiate' && 'You have indicated you wish to negotiate new terms.'}
            </Text>
          </View>
        )}

        {/* Negotiation History */}
        {negotiations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Negotiation History</Text>
            {negotiations.map((n) => {
              const statusInfo = NEGOTIATION_STATUS_INFO[n.status] || NEGOTIATION_STATUS_INFO.expired;
              const isMyProposal = n.initiated_by === userId;
              return (
                <View key={n.id} style={styles.negotiationItem}>
                  <View style={styles.negotiationTop}>
                    <Text style={styles.negotiationRound}>Round {n.round}</Text>
                    <Text style={styles.negotiationFrom}>
                      {isMyProposal ? 'Your Offer' : 'Owner Offer'}
                    </Text>
                    <View style={[styles.negoStatusBadge, { backgroundColor: statusInfo.bg }]}>
                      <Text style={[styles.negoStatusText, { color: statusInfo.color }]}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.negotiationRent}>
                    {formatZAR(n.proposed_monthly_rent)}/mo · {n.proposed_lease_type === 'fixed'
                      ? `${n.proposed_duration_months}mo fixed`
                      : 'Month-to-month'}
                  </Text>
                  {n.response_notes && (
                    <Text style={styles.negotiationNotes}>{n.response_notes}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    gap: 12,
  },
  backButton: { padding: 4 },
  headerText: { flex: 1 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  expiryCard: {
    backgroundColor: colors.background.default,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    gap: 16,
  },
  expiryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  expiryText: { flex: 1 },
  expiryDays: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
  },
  expiryLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  rentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  rentLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  rentAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.rsa.green,
  },
  section: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  noticeInfo: { flex: 1 },
  noticeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  noticeDate: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  sentBadge: {
    backgroundColor: '#E6F7F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.rsa.green,
  },
  offerCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 12,
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  offerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.rsa.blue,
  },
  offerTerms: {
    backgroundColor: colors.background.default,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  offerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offerLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  offerValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  offerNotes: {
    fontSize: 13,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  deadlineText: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '600',
  },
  offerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  offerAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1.5,
  },
  acceptAction: {
    backgroundColor: colors.rsa.green,
    borderColor: colors.rsa.green,
  },
  counterAction: {
    backgroundColor: colors.background.default,
    borderColor: colors.rsa.blue,
  },
  rejectAction: {
    backgroundColor: colors.background.default,
    borderColor: colors.rsa.red,
  },
  offerActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.rsa.white,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text.primary,
  },
  inputMulti: {
    minHeight: 80,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  formAction: {
    flex: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formActionPrimary: {
    backgroundColor: colors.rsa.green,
  },
  formActionSecondary: {
    backgroundColor: colors.background.default,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  formActionPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.rsa.white,
  },
  formActionSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  responseOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  responseOption: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background.default,
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  responseOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  responseOptionDesc: {
    fontSize: 11,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  recordedResponse: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
    marginTop: 4,
  },
  negotiationItem: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  negotiationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  negotiationRound: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  negotiationFrom: {
    flex: 1,
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '500',
  },
  negoStatusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  negoStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  negotiationRent: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  negotiationNotes: {
    fontSize: 12,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
});
