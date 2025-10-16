import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { quotesApi, Quote, QuoteRevision } from '@/src/features/maintenance/api/quotesApi';
import { colors } from '@/src/shared/theme/colors';

const RSA = { blue: '#002395' };

const STATUS_CONFIG = {
  requested: { label: 'Requested', color: colors.gray[500], icon: 'time-outline' },
  submitted: { label: 'Submitted', color: colors.info[500], icon: 'document-text' },
  approved: { label: 'Approved', color: colors.success[500], icon: 'checkmark-circle' },
  rejected: { label: 'Rejected', color: colors.error[500], icon: 'close-circle' },
  revision_requested: { label: 'Revision Requested', color: colors.warning[500], icon: 'create-outline' },
};

export default function VendorQuoteDetailScreen() {
  const { quoteId } = useLocalSearchParams<{ quoteId: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [revisions, setRevisions] = useState<QuoteRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Edit form state
  const [editSubtotal, setEditSubtotal] = useState('');
  const [editVAT, setEditVAT] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [editTotal, setEditTotal] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editReason, setEditReason] = useState('');

  useEffect(() => {
    if (quoteId) {
      fetchQuoteDetails();
    }
  }, [quoteId]);

  const fetchQuoteDetails = async () => {
    try {
      setLoading(true);
      const quoteData = await quotesApi.getQuoteById(quoteId);
      setQuote(quoteData);
      
      // Initialize edit form
      setEditSubtotal(quoteData.subtotal?.toString() || '0');
      setEditVAT(quoteData.vat_amount?.toString() || '0');
      setEditDiscount(quoteData.discount_amount?.toString() || '0');
      setEditTotal(quoteData.total_amount?.toString() || '0');
      setEditNotes(quoteData.notes || '');
      
      const revisionsData = await quotesApi.getQuoteRevisions(quoteId);
      setRevisions(revisionsData);
    } catch (error: any) {
      console.error('Error fetching quote:', error);
      Alert.alert('Error', 'Failed to load quote details');
    } finally {
      setLoading(false);
    }
  };

  const handleEditToggle = () => {
    if (editMode) {
      // Cancel edit
      if (quote) {
        setEditSubtotal(quote.subtotal?.toString() || '0');
        setEditVAT(quote.vat_amount?.toString() || '0');
        setEditDiscount(quote.discount_amount?.toString() || '0');
        setEditTotal(quote.total_amount?.toString() || '0');
        setEditNotes(quote.notes || '');
        setEditReason('');
      }
    }
    setEditMode(!editMode);
  };

  const handleSaveEdit = async () => {
    if (!editReason.trim()) {
      Alert.alert('Revision Reason Required', 'Please provide a reason for this revision');
      return;
    }

    Alert.alert(
      'Update Quote',
      'This will create a new revision and notify the owner. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              // Get current user ID (vendor)
              const userId = 'current-vendor-id'; // TODO: Get from auth context

              await quotesApi.updateQuote(
                quoteId,
                {
                  subtotal: parseFloat(editSubtotal),
                  vat_amount: parseFloat(editVAT),
                  discount_amount: parseFloat(editDiscount),
                  total_amount: parseFloat(editTotal),
                  notes: editNotes,
                  revision_reason: editReason,
                },
                userId
              );

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Quote updated and resubmitted');
              setEditMode(false);
              setEditReason('');
              fetchQuoteDetails();
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to update quote');
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
  const hasRevisions = revisions.length > 0;
  const canEdit = quote.status === 'submitted' || quote.status === 'revision_requested';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quote Details</Text>
        {canEdit && (
          <TouchableOpacity 
            onPress={handleEditToggle} 
            style={styles.headerButton}
            disabled={actionLoading}
          >
            <Ionicons 
              name={editMode ? "close" : "create-outline"} 
              size={24} 
              color={editMode ? colors.error[500] : RSA.blue} 
            />
          </TouchableOpacity>
        )}
        {!canEdit && <View style={styles.headerButton} />}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
            <Ionicons name={statusConfig.icon as any} size={20} color="#FFFFFF" />
            <Text style={styles.statusText}>{statusConfig.label}</Text>
          </View>
        </View>

        {quote.contract_id && (
          <View style={styles.section}>
            <View style={styles.contractBanner}>
              <Ionicons name="document-text-outline" size={20} color={colors.info[600]} />
              <Text style={styles.contractBannerText}>Long-term Contract Quote</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cost Breakdown</Text>
            {hasRevisions && !editMode && (
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

          {editMode ? (
            <View style={styles.editCard}>
              <View style={styles.editRow}>
                <Text style={styles.editLabel}>Subtotal (R)</Text>
                <TextInput
                  style={styles.editInput}
                  value={editSubtotal}
                  onChangeText={setEditSubtotal}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
              <View style={styles.editRow}>
                <Text style={styles.editLabel}>VAT (R)</Text>
                <TextInput
                  style={styles.editInput}
                  value={editVAT}
                  onChangeText={setEditVAT}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
              <View style={styles.editRow}>
                <Text style={styles.editLabel}>Discount (R)</Text>
                <TextInput
                  style={styles.editInput}
                  value={editDiscount}
                  onChangeText={setEditDiscount}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.editRow}>
                <Text style={styles.totalLabel}>Total (R)</Text>
                <TextInput
                  style={[styles.editInput, styles.totalInput]}
                  value={editTotal}
                  onChangeText={setEditTotal}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
              
              <View style={styles.reasonSection}>
                <Text style={styles.reasonLabel}>Notes (Optional)</Text>
                <TextInput
                  style={styles.reasonInput}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Add any notes about the work..."
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.reasonSection}>
                <Text style={styles.reasonLabel}>Reason for Revision *</Text>
                <TextInput
                  style={styles.reasonInput}
                  value={editReason}
                  onChangeText={setEditReason}
                  placeholder="Explain what changed..."
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.editActionButton, styles.cancelButton]}
                  onPress={handleEditToggle}
                  disabled={actionLoading}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editActionButton, styles.saveButton]}
                  onPress={handleSaveEdit}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save & Resubmit</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.costCard}>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Subtotal</Text>
                <Text style={styles.costValue}>R {quote.subtotal?.toLocaleString() || '0'}</Text>
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>VAT (15%)</Text>
                <Text style={styles.costValue}>R {quote.vat_amount?.toLocaleString() || '0'}</Text>
              </View>
              {quote.discount_amount && quote.discount_amount > 0 && (
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
          )}

          {quote.revision_number && quote.revision_number > 0 && !editMode && (
            <View style={styles.revisionBadge}>
              <Ionicons name="refresh" size={16} color={colors.warning[600]} />
              <Text style={styles.revisionBadgeText}>
                Revision {quote.revision_number} {hasRevisions && `(${revisions.length} previous)`}
              </Text>
            </View>
          )}
        </View>

        {quote.notes && !editMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{quote.notes}</Text>
            </View>
          </View>
        )}

        {quote.revision_reason && !editMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {quote.status === 'revision_requested' ? 'Owner Requested Changes' : 'Your Last Revision'}
            </Text>
            <View style={[styles.notesCard, { backgroundColor: colors.warning[50], borderColor: colors.warning[500] }]}>
              <Text style={styles.notesText}>{quote.revision_reason}</Text>
            </View>
          </View>
        )}

        {showRevisions && hasRevisions && !editMode && (
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

        <View style={{ height: 100 }} />
      </ScrollView>
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
  
  contractBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    backgroundColor: colors.info[50], 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: colors.info[500] 
  },
  contractBannerText: { fontSize: 15, fontWeight: '600', color: colors.info[700] },
  
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
  
  editCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 12, 
    padding: 16, 
    borderWidth: 2, 
    borderColor: RSA.blue 
  },
  editRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  editLabel: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
  editInput: { 
    flex: 1, 
    borderWidth: 1, 
    borderColor: '#d1d5db', 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    fontSize: 15, 
    textAlign: 'right',
    backgroundColor: '#FFFFFF',
  },
  totalInput: { fontSize: 18, fontWeight: '700', color: RSA.blue },
  
  reasonSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  reasonLabel: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 },
  reasonInput: { 
    borderWidth: 1, 
    borderColor: '#d1d5db', 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    fontSize: 15,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  
  editActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  editActionButton: { 
    flex: 1, 
    paddingVertical: 12, 
    borderRadius: 8, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db' },
  cancelButtonText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  saveButton: { backgroundColor: RSA.blue },
  saveButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  
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
});
