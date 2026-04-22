/**
 * Owner Lease Renewal Screen
 *
 * CPA s14(2)(c): Must notify tenant 80/60/40 business days before lease expiry.
 * Manages renewal negotiations across all expiring leases.
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import { leaseExpiryApi, LeaseExpiryInfo, ExpiringLease } from '@/src/features/leases/api/leaseExpiry.api';
import { leaseRenewalApi, RenewalNegotiation } from '@/src/features/leases/api/leaseRenewal.api';
import { colors } from '@/src/shared/theme/colors';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatZAR = (amount: number) =>
  `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface LeaseWithDetails {
  lease: ExpiringLease;
  expiry: LeaseExpiryInfo;
  latestNeg: RenewalNegotiation | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OwnerLeaseRenewalScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [leases, setLeases] = useState<LeaseWithDetails[]>([]);
  const [offerModal, setOfferModal] = useState<string | null>(null); // leaseId
  const [proposedRent, setProposedRent] = useState('');
  const [leaseType, setLeaseType] = useState<'fixed' | 'month_to_month'>('fixed');
  const [durationMonths, setDurationMonths] = useState('12');
  const [escalationRate, setEscalationRate] = useState('');
  const [offerNotes, setOfferNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [executingLeaseId, setExecutingLeaseId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadExpiringLeases();
    }, [])
  );

  const loadExpiringLeases = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const expiring = await leaseExpiryApi.getExpiringLeases(user.id, 120);

      // Load expiry info + latest negotiation for each lease in parallel
      const details = await Promise.all(
        expiring.map(async (lease) => {
          const [expiry, latestNeg] = await Promise.all([
            leaseExpiryApi.getLeaseExpiryInfo(lease.id),
            leaseRenewalApi.getLatestNegotiation(lease.id),
          ]);
          return { lease, expiry, latestNeg };
        })
      );

      setLeases(details);
    } catch (err: any) {
      console.error('Error loading expiring leases:', err);
      Alert.alert('Error', 'Failed to load renewal information');
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotice = async (leaseId: string, noticeType: '80' | '60' | '40') => {
    try {
      await leaseExpiryApi.recordNoticeSent(leaseId, noticeType);
      Alert.alert('Notice Recorded', `${noticeType}-day CPA notice marked as sent.`);
      loadExpiringLeases();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record notice');
    }
  };

  const handleOpenOfferModal = (leaseId: string, currentRent: number) => {
    setOfferModal(leaseId);
    setProposedRent(Math.round(currentRent * 1.05).toString()); // Default: 5% escalation
    setLeaseType('fixed');
    setDurationMonths('12');
    setEscalationRate('5');
    setOfferNotes('');
  };

  const handleSendOffer = async () => {
    if (!offerModal || !userId) return;
    const rentNum = parseFloat(proposedRent);
    if (isNaN(rentNum) || rentNum < 100) {
      Alert.alert('Invalid Rent', 'Please enter a valid monthly rent amount');
      return;
    }

    setSubmitting(true);
    try {
      // Get lease end date for start of new lease
      const target = leases.find(l => l.lease.id === offerModal);
      const startDate = target?.lease.end_date
        ? (() => {
            const d = new Date(target.lease.end_date);
            d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
          })()
        : new Date().toISOString().split('T')[0];

      await leaseRenewalApi.proposeRenewal(userId, {
        leaseId: offerModal,
        proposedRent: rentNum,
        leaseType,
        durationMonths: leaseType === 'fixed' ? parseInt(durationMonths) || 12 : undefined,
        startDate,
        escalationRate: escalationRate ? parseFloat(escalationRate) / 100 : undefined,
        notes: offerNotes.trim() || undefined,
      });

      Alert.alert('Offer Sent', 'The tenant has been notified of your renewal offer.');
      setOfferModal(null);
      loadExpiringLeases();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send renewal offer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptTenantOffer = async (negotiationId: string) => {
    if (!userId) return;
    Alert.alert(
      'Accept Tenant Terms',
      'Are you sure you want to accept the tenant\'s proposed terms? A new lease will be drafted for both parties to sign.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          style: 'default',
          onPress: async () => {
            try {
              await leaseRenewalApi.acceptRenewal(negotiationId, userId);
              Alert.alert('Accepted', 'You have accepted the tenant\'s terms. Execute the renewal to create the new lease.');
              loadExpiringLeases();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to accept offer');
            }
          },
        },
      ]
    );
  };

  const handleRejectTenantOffer = async (negotiationId: string) => {
    Alert.prompt(
      'Reject Counter-Offer',
      'Provide a reason for rejecting the tenant\'s terms (optional):',
      async (reason) => {
        try {
          await leaseRenewalApi.rejectRenewal(negotiationId, reason || undefined);
          Alert.alert('Rejected', 'The tenant\'s counter-offer has been rejected.');
          loadExpiringLeases();
        } catch (err: any) {
          Alert.alert('Error', err.message || 'Failed to reject offer');
        }
      },
      'plain-text',
      '',
    );
  };

  const handleExecuteRenewal = async (negotiationId: string, leaseId: string) => {
    Alert.alert(
      'Execute Renewal',
      'This will create a new lease and send it to both parties for signing. The current lease will be marked as expired.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create New Lease',
          onPress: async () => {
            setExecutingLeaseId(leaseId);
            try {
              await leaseRenewalApi.executeRenewal(negotiationId);
              Alert.alert(
                'Renewal Executed',
                'New lease created successfully and is now pending dual-party signing.',
                [{ text: 'OK', onPress: loadExpiringLeases }]
              );
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to execute renewal');
            } finally {
              setExecutingLeaseId(null);
            }
          },
        },
      ]
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Lease Renewals</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.rsa.blue} />
        </View>
      </SafeAreaView>
    );
  }

  const overdueNotices = leases.filter(l =>
    (!l.expiry.notice80Sent && new Date() >= new Date(l.expiry.notice80Due)) ||
    (!l.expiry.notice60Sent && new Date() >= new Date(l.expiry.notice60Due)) ||
    (!l.expiry.notice40Sent && new Date() >= new Date(l.expiry.notice40Due))
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Lease Renewals</Text>
        {overdueNotices.length > 0 && (
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{overdueNotices.length}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Overdue Notices Warning */}
        {overdueNotices.length > 0 && (
          <View style={styles.warningCard}>
            <Ionicons name="alert-circle" size={20} color={colors.rsa.red} />
            <Text style={styles.warningText}>
              {overdueNotices.length} lease{overdueNotices.length > 1 ? 's have' : ' has'} overdue CPA notices.
              Failure to notify tenants on time may result in penalties.
            </Text>
          </View>
        )}

        {/* Legal Notice */}
        <View style={styles.legalNotice}>
          <Ionicons name="information-circle" size={16} color={colors.rsa.blue} />
          <Text style={styles.legalText}>
            CPA s14(2)(c): You must notify tenants 80, 60, and 40 business days before lease expiry.
            Showing leases expiring within 120 days.
          </Text>
        </View>

        {/* Lease List */}
        {leases.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No Expiring Leases</Text>
            <Text style={styles.emptySubtitle}>
              No leases are expiring within the next 120 days
            </Text>
          </View>
        ) : (
          leases.map(({ lease, expiry, latestNeg }) => {
            const urgencyColor = expiry.daysUntilExpiry <= 40
              ? colors.rsa.red
              : expiry.daysUntilExpiry <= 60
              ? '#F59E0B'
              : colors.rsa.green;

            const tenantResponse = lease.tenant_renewal_response;
            const hasActiveOffer = latestNeg && ['pending', 'counter_offer'].includes(latestNeg.status);

            return (
              <View key={lease.id} style={styles.leaseCard}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.propertyName}>{lease.property?.title || 'Property'}</Text>
                    <Text style={styles.tenantName}>{lease.tenant?.full_name || 'Tenant'}</Text>
                    <View style={[styles.expiryBadge, { backgroundColor: urgencyColor + '20' }]}>
                      <Text style={[styles.expiryBadgeText, { color: urgencyColor }]}>
                        {expiry.daysUntilExpiry} days remaining
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardHeaderRight}>
                    <Text style={styles.rentLabel}>Monthly Rent</Text>
                    <Text style={styles.rentAmount}>{formatZAR(lease.monthly_rent)}</Text>
                    <Text style={styles.expiryDate}>
                      Expires {new Date(lease.end_date).toLocaleDateString('en-ZA')}
                    </Text>
                  </View>
                </View>

                {/* CPA Notices */}
                <View style={styles.noticesRow}>
                  {[
                    { type: '80' as const, sent: expiry.notice80Sent, due: expiry.notice80Due },
                    { type: '60' as const, sent: expiry.notice60Sent, due: expiry.notice60Due },
                    { type: '40' as const, sent: expiry.notice40Sent, due: expiry.notice40Due },
                  ].map((notice) => {
                    const isOverdue = !notice.sent && new Date() >= new Date(notice.due);
                    return (
                      <TouchableOpacity
                        key={notice.type}
                        style={[
                          styles.noticeChip,
                          notice.sent && styles.noticeChipSent,
                          isOverdue && styles.noticeChipOverdue,
                        ]}
                        onPress={() => {
                          if (!notice.sent) {
                            Alert.alert(
                              `Mark ${notice.type}-Day Notice Sent`,
                              `This records that you have sent the ${notice.type}-business-day CPA notice to the tenant.`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Mark Sent',
                                  onPress: () => handleSendNotice(lease.id, notice.type),
                                },
                              ]
                            );
                          }
                        }}
                        disabled={notice.sent}
                      >
                        <Text style={[
                          styles.noticeChipText,
                          notice.sent && styles.noticeChipTextSent,
                          isOverdue && styles.noticeChipTextOverdue,
                        ]}>
                          {notice.sent ? '✓' : isOverdue ? '!' : '○'} {notice.type}-day
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Tenant Response */}
                {tenantResponse && (
                  <View style={styles.tenantResponseRow}>
                    <Ionicons name="person" size={14} color={colors.text.secondary} />
                    <Text style={styles.tenantResponseText}>
                      Tenant response:{' '}
                      <Text style={{ fontWeight: '700', color: colors.text.primary }}>
                        {tenantResponse === 'renew' ? 'Wants to renew'
                          : tenantResponse === 'terminate' ? 'Not renewing'
                          : 'Open to negotiate'}
                      </Text>
                    </Text>
                  </View>
                )}

                {/* Active Negotiation Status */}
                {hasActiveOffer && latestNeg && (
                  <View style={styles.activeOfferRow}>
                    <Ionicons name="chatbubbles" size={14} color={colors.rsa.blue} />
                    <Text style={styles.activeOfferText}>
                      Round {latestNeg.round}: {formatZAR(latestNeg.proposed_monthly_rent)}/mo offered
                      {latestNeg.status === 'counter_offer' ? ' (counter-offer from tenant)' : ''}
                    </Text>
                  </View>
                )}

                {/* Accepted negotiation status row */}
                {latestNeg?.status === 'accepted' && (
                  <View style={styles.activeOfferRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.rsa.green} />
                    <Text style={[styles.activeOfferText, { color: colors.rsa.green }]}>
                      Round {latestNeg.round}: {formatZAR(latestNeg.proposed_monthly_rent)}/mo accepted by tenant
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.cardActions}>
                  {latestNeg?.status === 'accepted' ? (
                    <>
                      <View style={styles.acceptedBanner}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.rsa.green} />
                        <Text style={styles.acceptedBannerText}>
                          Tenant accepted · Execute to create the new lease
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.executeButton,
                          executingLeaseId === lease.id && styles.submitButtonDisabled,
                        ]}
                        onPress={() => handleExecuteRenewal(latestNeg.id, lease.id)}
                        disabled={!!executingLeaseId}
                      >
                        {executingLeaseId === lease.id ? (
                          <ActivityIndicator size="small" color={colors.rsa.white} />
                        ) : (
                          <>
                            <Ionicons name="rocket" size={16} color={colors.rsa.white} />
                            <Text style={styles.executeButtonText}>Execute Renewal (Create New Lease)</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : hasActiveOffer && latestNeg && latestNeg.status === 'pending' && latestNeg.initiated_by !== userId ? (
                    // Tenant sent a counter — owner can accept, reject, or counter back
                    <>
                      <View style={styles.tenantCounterBanner}>
                        <Ionicons name="swap-horizontal" size={14} color="#8B5CF6" />
                        <Text style={styles.tenantCounterBannerText}>
                          Tenant proposes {formatZAR(latestNeg.proposed_monthly_rent)}/mo · Round {latestNeg.round}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.acceptTenantButton}
                        onPress={() => handleAcceptTenantOffer(latestNeg.id)}
                      >
                        <Ionicons name="checkmark" size={16} color="#FFF" />
                        <Text style={styles.acceptTenantButtonText}>Accept Tenant Terms</Text>
                      </TouchableOpacity>
                      <View style={styles.twoButtonRow}>
                        <TouchableOpacity
                          style={styles.rejectButton}
                          onPress={() => handleRejectTenantOffer(latestNeg.id)}
                        >
                          <Ionicons name="close" size={16} color="#DC2626" />
                          <Text style={styles.rejectButtonText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.counterButton}
                          onPress={() => handleOpenOfferModal(lease.id, latestNeg.proposed_monthly_rent)}
                        >
                          <Ionicons name="swap-horizontal" size={16} color={colors.rsa.blue} />
                          <Text style={styles.counterButtonText}>My Counter</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.offerButton}
                      onPress={() => handleOpenOfferModal(lease.id, lease.monthly_rent)}
                    >
                      <Ionicons name="send" size={16} color={colors.rsa.white} />
                      <Text style={styles.offerButtonText}>
                        {hasActiveOffer ? 'Send Counter-Offer' : 'Send Renewal Offer'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Offer Modal */}
      <Modal
        visible={!!offerModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOfferModal(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setOfferModal(null)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Send Renewal Offer</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            {/* Lease Type */}
            <Text style={styles.fieldLabel}>Lease Type</Text>
            <View style={styles.segmentControl}>
              <TouchableOpacity
                style={[styles.segment, leaseType === 'fixed' && styles.segmentActive]}
                onPress={() => setLeaseType('fixed')}
              >
                <Text style={[styles.segmentText, leaseType === 'fixed' && styles.segmentTextActive]}>
                  Fixed Term
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, leaseType === 'month_to_month' && styles.segmentActive]}
                onPress={() => setLeaseType('month_to_month')}
              >
                <Text style={[styles.segmentText, leaseType === 'month_to_month' && styles.segmentTextActive]}>
                  Month-to-Month
                </Text>
              </TouchableOpacity>
            </View>

            {leaseType === 'fixed' && (
              <>
                <Text style={styles.fieldLabel}>Duration (months)</Text>
                <TextInput
                  style={styles.input}
                  value={durationMonths}
                  onChangeText={setDurationMonths}
                  keyboardType="numeric"
                  placeholder="12"
                  placeholderTextColor={colors.gray[400]}
                />
              </>
            )}

            <Text style={styles.fieldLabel}>Proposed Monthly Rent (R) *</Text>
            <TextInput
              style={styles.input}
              value={proposedRent}
              onChangeText={setProposedRent}
              keyboardType="numeric"
              placeholder="e.g. 9500"
              placeholderTextColor={colors.gray[400]}
            />

            <Text style={styles.fieldLabel}>Annual Escalation Rate (% — optional)</Text>
            <TextInput
              style={styles.input}
              value={escalationRate}
              onChangeText={setEscalationRate}
              keyboardType="numeric"
              placeholder="e.g. 5"
              placeholderTextColor={colors.gray[400]}
            />

            <Text style={styles.fieldLabel}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={offerNotes}
              onChangeText={setOfferNotes}
              placeholder="Any terms or conditions to include..."
              placeholderTextColor={colors.gray[400]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSendOffer}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.rsa.white} />
              ) : (
                <>
                  <Ionicons name="send" size={18} color={colors.rsa.white} />
                  <Text style={styles.submitButtonText}>Send Renewal Offer</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      </KeyboardAvoidingView>
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
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  alertBadge: {
    backgroundColor: colors.rsa.red,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  alertBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.rsa.white,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: colors.rsa.red,
    lineHeight: 18,
  },
  legalNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#E6EBF5',
    borderRadius: 8,
    padding: 12,
  },
  legalText: {
    flex: 1,
    fontSize: 12,
    color: colors.rsa.blue,
    lineHeight: 17,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
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
    maxWidth: 260,
  },
  leaseCard: {
    backgroundColor: colors.background.default,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: { flex: 1, gap: 4 },
  propertyName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  tenantName: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  expiryBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  expiryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardHeaderRight: { alignItems: 'flex-end', gap: 2 },
  rentLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  rentAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.rsa.blue,
  },
  expiryDate: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  noticesRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  noticeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  noticeChipSent: {
    backgroundColor: '#E6F7F0',
    borderColor: colors.rsa.green,
  },
  noticeChipOverdue: {
    backgroundColor: '#FEF2F2',
    borderColor: colors.rsa.red,
  },
  noticeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  noticeChipTextSent: {
    color: colors.rsa.green,
  },
  noticeChipTextOverdue: {
    color: colors.rsa.red,
  },
  tenantResponseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background.secondary,
  },
  tenantResponseText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  activeOfferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
  },
  activeOfferText: {
    fontSize: 13,
    color: colors.rsa.blue,
    flex: 1,
  },
  cardActions: {
    padding: 16,
    paddingTop: 8,
  },
  offerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.rsa.blue,
    borderRadius: 10,
    padding: 13,
  },
  offerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.rsa.white,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 32,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
    marginTop: 14,
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: colors.rsa.blue,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  segmentTextActive: {
    color: colors.rsa.white,
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
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.rsa.blue,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.rsa.white,
  },
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E6F7F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  acceptedBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.rsa.green,
    flex: 1,
  },
  executeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.rsa.green,
    borderRadius: 10,
    padding: 13,
  },
  executeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.rsa.white,
  },
  tenantCounterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  tenantCounterBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C3AED',
    flex: 1,
  },
  acceptTenantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.rsa.green,
    borderRadius: 10,
    padding: 13,
    marginBottom: 8,
  },
  acceptTenantButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  twoButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  counterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF2FF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  counterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.rsa.blue,
  },
});
