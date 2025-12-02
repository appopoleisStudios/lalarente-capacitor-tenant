import { useAuth } from '@/src/contexts/AuthContext';
import {
    acceptQuote,
    getQuoteById,
    getQuoteRevisions,
    rejectQuote,
    requestQuoteRevision,
    type Quote,
    type QuoteRevision,
} from '@/src/features/maintenance/api';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RSA = { blue: '#002395' };

const STATUS_CONFIG = {
  requested: { label: 'Requested', color: colors.gray[500], icon: 'time-outline' },
  submitted: { label: 'Submitted', color: colors.info[500], icon: 'document-text' },
  approved: { label: 'Approved', color: colors.success[500], icon: 'checkmark-circle' },
  rejected: { label: 'Rejected', color: colors.error[500], icon: 'close-circle' },
  revision_requested: { label: 'Revision Requested', color: colors.warning[500], icon: 'create-outline' },
};

export default function OwnerQuoteDetailScreen() {
  const { quoteId, requestId } = useLocalSearchParams<{ quoteId: string; requestId: string }>();
  const { user } = useAuth();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [revisions, setRevisions] = useState<QuoteRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);

  useEffect(() => {
    if (quoteId) {
      fetchQuoteDetails();
    }
  }, [quoteId]);

  // Refetch data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (quoteId) {
        fetchQuoteDetails();
      }
    }, [quoteId])
  );

  const fetchQuoteDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch quote
      const quoteData = await getQuoteById(quoteId);
      setQuote(quoteData);
      
      // Fetch revisions
      const revisionsData = await getQuoteRevisions(quoteId);
      setRevisions(revisionsData);
      
    } catch (error: any) {
      console.error('Error fetching quote:', error);
      Alert.alert('Error', 'Failed to load quote details');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptQuote = async () => {
    Alert.alert(
      'Accept Quote',
      'This will generate a Purchase Order and notify the vendor. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept & Generate PO',
          onPress: async () => {
            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              // Accept the quote (new function handles everything)
              if (!user?.id) {
                throw new Error('User not authenticated');
              }
              
              const result = await acceptQuote(quoteId, user.id);
              console.log('✅ Quote acceptance result:', result);
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Quote accepted and PO generated', [
                {
                  text: 'OK',
                  onPress: () => {
                    // Navigate back to maintenance detail
                    router.back();
                  },
                },
              ]);
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to accept quote');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRejectQuote = async () => {
    Alert.alert(
      'Reject Quote',
      'Are you sure you want to reject this quote? The vendor will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              if (!user?.id) {
                throw new Error('User not authenticated');
              }
              
              await rejectQuote(quoteId, user.id, 'Quote rejected by owner');
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Quote rejected', [
                {
                  text: 'OK',
                  onPress: () => {
                    router.back();
                  },
                },
              ]);
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to reject quote');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRequestRevision = () => {
    Alert.prompt(
      'Request Revision',
      'Please explain what changes you need:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          onPress: async (reason?: string) => {
            if (!reason || reason.trim() === '') {
              Alert.alert('Error', 'Please provide a reason for the revision');
              return;
            }

            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              if (!user?.id) {
                throw new Error('User not authenticated');
              }

              await requestQuoteRevision(quoteId, user.id, reason);
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Revision request sent to vendor');
              fetchQuoteDetails(); // Refresh
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to request revision');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RSA.blue} />
          <Text style={styles.loadingText}>Loading quote...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!quote) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.error[500]} />
          <Text style={styles.errorText}>Quote not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[quote.status as keyof typeof STATUS_CONFIG];
  const canTakeAction = quote.status === 'submitted' || quote.status === 'revision_requested';
  const hasRevisions = revisions.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quote Details</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
            <Ionicons name={statusConfig.icon as any} size={20} color="#FFFFFF" />
            <Text style={styles.statusText}>{statusConfig.label}</Text>
          </View>
        </View>

        {/* Vendor Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vendor</Text>
          <View style={styles.vendorCard}>
            <View style={styles.vendorAvatar}>
              <Ionicons name="person" size={32} color={colors.gray[400]} />
            </View>
            <View style={styles.vendorInfo}>
              <View style={styles.vendorNameRow}>
                <Text style={styles.vendorName}>{quote.vendor?.full_name}</Text>
                {quote.contract_id && (
                  <View style={styles.contractBadge}>
                    <Ionicons name="document-text-outline" size={12} color={colors.info[600]} />
                    <Text style={styles.contractBadgeText}>Contract</Text>
                  </View>
                )}
              </View>
              <Text style={styles.vendorContact}>{quote.vendor?.phone}</Text>
              <Text style={styles.vendorContact}>{quote.vendor?.email}</Text>
            </View>
          </View>
        </View>

        {/* Cost Breakdown */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cost Breakdown</Text>
            {hasRevisions && (
              <TouchableOpacity
                onPress={() => setShowRevisions(!showRevisions)}
                style={styles.revisionToggle}
              >
                <Text style={styles.revisionToggleText}>
                  {showRevisions ? 'Hide' : 'Show'} History
                </Text>
                <Ionicons
                  name={showRevisions ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={RSA.blue}
                />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.costCard}>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Subtotal</Text>
              <Text style={styles.costValue}>R {quote.subtotal?.toLocaleString() || '0'}</Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>VAT (15%)</Text>
              <Text style={styles.costValue}>R {quote.vat_amount?.toLocaleString() || '0'}</Text>
            </View>
            {quote.discount_amount != null && quote.discount_amount > 0 && (
              <View style={styles.costRow}>
                <Text style={[styles.costLabel, { color: colors.success[600] }]}>Discount</Text>
                <Text style={[styles.costValue, { color: colors.success[600] }]}>
                  -R {quote.discount_amount.toLocaleString()}
                </Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.costRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>R {quote.total_amount?.toLocaleString() || '0'}</Text>
            </View>
          </View>

          {/* Revision Badge */}
          {quote.revision_number != null && quote.revision_number > 0 && (
            <View style={styles.revisionBadge}>
              <Ionicons name="refresh" size={16} color={colors.warning[600]} />
              <Text style={styles.revisionBadgeText}>
                Revision {quote.revision_number} {hasRevisions ? `(${revisions.length} previous)` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {quote.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes from Vendor</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{quote.notes}</Text>
            </View>
          </View>
        )}

        {/* Revision Reason */}
        {quote.revision_reason && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {quote.status === 'revision_requested' ? 'Revision Requested' : 'Revision Reason'}
            </Text>
            <View style={[styles.notesCard, { backgroundColor: colors.warning[50], borderColor: colors.warning[500] }]}>
              <Text style={styles.notesText}>{quote.revision_reason}</Text>
            </View>
          </View>
        )}

        {/* Revision History */}
        {showRevisions && hasRevisions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Revision History</Text>
            {revisions.map((revision, index) => (
              <View key={revision.id} style={styles.revisionCard}>
                <View style={styles.revisionHeader}>
                  <View style={styles.revisionNumber}>
                    <Text style={styles.revisionNumberText}>v{revision.revision_number}</Text>
                  </View>
                  <Text style={styles.revisionDate}>
                    {new Date(revision.created_at).toLocaleDateString('en-ZA', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                
                <View style={styles.revisionCosts}>
                  <View style={styles.revisionCostRow}>
                    <Text style={styles.revisionCostLabel}>Total</Text>
                    <Text style={styles.revisionCostValue}>
                      R {revision.total_amount.toLocaleString()}
                    </Text>
                  </View>
                  {index < revisions.length - 1 && (
                    <View style={styles.revisionDiff}>
                      <Ionicons
                        name={revision.total_amount > revisions[index + 1].total_amount ? 'arrow-up' : 'arrow-down'}
                        size={14}
                        color={revision.total_amount > revisions[index + 1].total_amount ? colors.error[500] : colors.success[500]}
                      />
                      <Text style={[
                        styles.revisionDiffText,
                        { color: revision.total_amount > revisions[index + 1].total_amount ? colors.error[500] : colors.success[500] }
                      ]}>
                        R {Math.abs(revision.total_amount - revisions[index + 1].total_amount).toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>

                {revision.revision_reason && (
                  <View style={styles.revisionReason}>
                    <Text style={styles.revisionReasonLabel}>Reason:</Text>
                    <Text style={styles.revisionReasonText}>{revision.revision_reason}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.timeline}>
            <TimelineItem
              icon="add-circle"
              label="Quote Created"
              date={new Date(quote.created_at).toLocaleDateString()}
              completed
            />
            {quote.status === 'submitted' && (
              <TimelineItem
                icon="document-text"
                label="Submitted"
                date={new Date(quote.updated_at).toLocaleDateString()}
                completed
              />
            )}
            {quote.status === 'revision_requested' && (
              <TimelineItem
                icon="create"
                label="Revision Requested"
                date={new Date(quote.updated_at).toLocaleDateString()}
                completed
              />
            )}
            {quote.status === 'approved' && (
              <TimelineItem
                icon="checkmark-circle"
                label="Approved"
                date={new Date(quote.updated_at).toLocaleDateString()}
                completed
              />
            )}
            {quote.status === 'rejected' && (
              <TimelineItem
                icon="close-circle"
                label="Rejected"
                date={new Date(quote.updated_at).toLocaleDateString()}
                completed
              />
            )}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action Buttons */}
      {canTakeAction && (
        <View style={styles.footer}>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={handleRejectQuote}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.error[600]} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={20} color={colors.error[600]} />
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.revisionButton]}
              onPress={handleRequestRevision}
              disabled={actionLoading}
            >
              <Ionicons name="create-outline" size={20} color={colors.warning[600]} />
              <Text style={styles.revisionButtonText}>Request Changes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={handleAcceptQuote}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// Timeline Item Component
function TimelineItem({
  icon,
  label,
  date,
  completed,
}: {
  icon: string;
  label: string;
  date: string;
  completed: boolean;
}) {
  return (
    <View style={styles.timelineItem}>
      <View style={[styles.timelineIcon, completed && styles.timelineIconCompleted]}>
        <Ionicons
          name={icon as any}
          size={16}
          color={completed ? '#FFFFFF' : colors.gray[400]}
        />
      </View>
      <View style={styles.timelineContent}>
        <Text style={styles.timelineLabel}>{label}</Text>
        <Text style={styles.timelineDate}>{date}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { marginTop: 16, fontSize: 18, fontWeight: '600', color: '#111827' },
  backButton: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: RSA.blue, borderRadius: 8 },
  backButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  
  // Header
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 16, 
    backgroundColor: '#FFFFFF', 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e7eb' 
  },
  headerButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  
  scrollView: { flex: 1 },
  
  // Status
  statusContainer: { alignItems: 'center', paddingVertical: 20 },
  statusBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 20 
  },
  statusText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  
  // Section
  section: { marginHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  
  // Vendor
  vendorCard: { 
    flexDirection: 'row', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 12, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: '#e5e7eb',
    gap: 12,
  },
  vendorAvatar: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: colors.gray[100], 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  vendorInfo: { flex: 1, justifyContent: 'center' },
  vendorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  vendorName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  vendorContact: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  contractBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    backgroundColor: colors.info[50], 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: colors.info[500] 
  },
  contractBadgeText: { fontSize: 11, fontWeight: '600', color: colors.info[700] },
  
  // Cost
  costCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 12, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: '#e5e7eb' 
  },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  costLabel: { fontSize: 15, color: '#6b7280' },
  costValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 8 },
  totalLabel: { fontSize: 18, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 24, fontWeight: '700', color: RSA.blue },
  
  // Revision Badge
  revisionBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginTop: 12, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    backgroundColor: colors.warning[50], 
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  revisionBadgeText: { fontSize: 13, fontWeight: '600', color: colors.warning[700] },
  
  // Revision Toggle
  revisionToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  revisionToggleText: { fontSize: 14, fontWeight: '600', color: RSA.blue },
  
  // Notes
  notesCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 12, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: '#e5e7eb' 
  },
  notesText: { fontSize: 15, color: '#374151', lineHeight: 22 },
  
  // Revision History
  revisionCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 12, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  revisionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  revisionNumber: { 
    backgroundColor: colors.gray[100], 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12 
  },
  revisionNumberText: { fontSize: 13, fontWeight: '700', color: colors.gray[700] },
  revisionDate: { fontSize: 13, color: '#6b7280' },
  revisionCosts: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  revisionCostRow: { flex: 1 },
  revisionCostLabel: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  revisionCostValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  revisionDiff: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  revisionDiffText: { fontSize: 14, fontWeight: '600' },
  revisionReason: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  revisionReasonLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  revisionReasonText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  
  // Timeline
  timeline: { gap: 16 },
  timelineItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  timelineIcon: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: colors.gray[200], 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  timelineIconCompleted: { backgroundColor: RSA.blue },
  timelineContent: { flex: 1 },
  timelineLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  timelineDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  
  // Footer Actions
  footer: { 
    padding: 16, 
    backgroundColor: '#FFFFFF', 
    borderTopWidth: 1, 
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButtons: { flexDirection: 'row', gap: 8 },
  actionButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6, 
    paddingVertical: 14, 
    borderRadius: 12,
    borderWidth: 2,
  },
  rejectButton: { 
    backgroundColor: '#FFFFFF', 
    borderColor: colors.error[500],
  },
  rejectButtonText: { fontSize: 15, fontWeight: '700', color: colors.error[600] },
  revisionButton: { 
    backgroundColor: '#FFFFFF', 
    borderColor: colors.warning[500],
  },
  revisionButtonText: { fontSize: 15, fontWeight: '700', color: colors.warning[600] },
  acceptButton: { 
    backgroundColor: RSA.blue,
    borderColor: RSA.blue,
  },
  acceptButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
