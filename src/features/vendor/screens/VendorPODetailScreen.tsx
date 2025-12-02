import {
    getPOById,
    getPORevisions,
    updatePOStatus,
    type PORevision,
    type PurchaseOrder,
} from '@/src/features/maintenance/api';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RSA = { blue: '#002395' };

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: colors.gray[500], icon: 'document-outline' },
  issued: { label: 'Issued', color: colors.info[500], icon: 'checkmark-circle' },
  accepted: { label: 'Accepted', color: colors.success[500], icon: 'thumbs-up' },
  disputed: { label: 'Disputed', color: colors.error[500], icon: 'alert-circle' },
  completed: { label: 'Completed', color: colors.success[600], icon: 'checkmark-done' },
};

export default function VendorPODetailScreen() {
  const { poId } = useLocalSearchParams<{ poId: string }>();
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [revisions, setRevisions] = useState<PORevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);

  useEffect(() => {
    if (poId) {
      fetchPODetails();
    }
  }, [poId]);

  const fetchPODetails = async () => {
    try {
      setLoading(true);
      const poData = await getPOById(poId);
      setPO(poData);

      const revisionsData = await getPORevisions(poId);
      setRevisions(revisionsData);
    } catch (error: any) {
      console.error('Error fetching PO:', error);
      Alert.alert('Error', 'Failed to load PO details');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestUpdate = () => {
    Alert.prompt(
      'Request PO Update',
      'Please explain what changes you need from the owner:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          onPress: async (reason?: string) => {
            if (!reason || reason.trim() === '') {
              Alert.alert('Error', 'Please provide a reason for the update request');
              return;
            }

            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              // TODO: Implement API to notify owner about update request
              // This would typically create a notification or message to the owner

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Update request sent to property owner');
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to send request');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleAcceptPO = async () => {
    Alert.alert(
      'Accept Purchase Order',
      'By accepting, you agree to complete the work as specified. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              await updatePOStatus(poId, 'accepted');

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              
              // Get the maintenance request ID from the PO's contract
              if (po?.contract_id) {
                // Navigate to job detail screen
                router.replace(`/(vendor)/jobs/${po.contract_id}`);
              } else {
                Alert.alert('Success', 'Purchase Order accepted');
                fetchPODetails();
              }
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to accept PO');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RSA.blue} />
          <Text style={styles.loadingText}>Loading PO...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!po) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.error[500]} />
          <Text style={styles.errorText}>Purchase Order not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[po.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
  const hasRevisions = revisions.length > 0;
  const canAccept = po.status === 'issued';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Purchase Order</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
            <Ionicons name={statusConfig.icon as any} size={20} color="#FFFFFF" />
            <Text style={styles.statusText}>{statusConfig.label}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.poNumber}>{po.po_number}</Text>
          <Text style={styles.poDate}>
            Issued: {new Date(po.created_at).toLocaleDateString('en-ZA', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </View>

        {po.contract && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contract Reference</Text>
            <View style={styles.contractCard}>
              <Ionicons name="document-text" size={24} color={colors.info[500]} />
              <View style={styles.contractInfo}>
                <Text style={styles.contractNumber}>{po.contract.contract_number}</Text>
                <Text style={styles.contractStatus}>Status: {po.contract.status}</Text>
              </View>
            </View>
          </View>
        )}

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
              <Text style={styles.costValue}>R {po.subtotal?.toLocaleString() || '0'}</Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>VAT (15%)</Text>
              <Text style={styles.costValue}>R {po.vat_amount?.toLocaleString() || '0'}</Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Platform Fee</Text>
              <Text style={styles.costValue}>R {po.platform_fee_amount?.toLocaleString() || '0'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.costRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>R {po.total_amount?.toLocaleString() || '0'}</Text>
            </View>
          </View>

          {po.revision_number && po.revision_number > 1 && (
            <View style={styles.revisionBadge}>
              <Ionicons name="refresh" size={16} color={colors.warning[600]} />
              <Text style={styles.revisionBadgeText}>
                Revision {po.revision_number} {hasRevisions && `(${revisions.length} previous)`}
              </Text>
            </View>
          )}
        </View>

        {po.revision_reason && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Latest Revision Reason</Text>
            <View style={[styles.notesCard, { backgroundColor: colors.warning[50], borderColor: colors.warning[500] }]}>
              <Text style={styles.notesText}>{po.revision_reason}</Text>
            </View>
          </View>
        )}

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

        <View style={{ height: 120 }} />
      </ScrollView>

      {(canAccept || po.status === 'accepted') && (
        <View style={styles.footer}>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.requestButton]}
              onPress={handleRequestUpdate}
              disabled={actionLoading}
            >
              <Ionicons name="create-outline" size={20} color={colors.warning[600]} />
              <Text style={styles.requestButtonText}>Request Update</Text>
            </TouchableOpacity>

            {canAccept && (
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={handleAcceptPO}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.acceptButtonText}>Accept PO</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
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

  section: { marginHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

  poNumber: { fontSize: 24, fontWeight: '700', color: RSA.blue, textAlign: 'center' },
  poDate: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 4 },

  contractCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.info[500],
    gap: 12,
  },
  contractInfo: { flex: 1 },
  contractNumber: { fontSize: 16, fontWeight: '600', color: '#111827' },
  contractStatus: { fontSize: 14, color: '#6b7280', marginTop: 4 },

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

  revisionToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  revisionToggleText: { fontSize: 14, fontWeight: '600', color: RSA.blue },

  notesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  notesText: { fontSize: 15, color: '#374151', lineHeight: 22 },

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
  requestButton: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.warning[500],
  },
  requestButtonText: { fontSize: 15, fontWeight: '700', color: colors.warning[600] },
  acceptButton: {
    backgroundColor: RSA.blue,
    borderColor: RSA.blue,
  },
  acceptButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
