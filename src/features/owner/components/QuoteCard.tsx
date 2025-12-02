import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';

const RSA = { blue: '#002395' };

const QUOTE_STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: colors.info[500], bgColor: colors.info[50] },
  approved: { label: 'Approved', color: colors.success[500], bgColor: colors.success[50] },
  rejected: { label: 'Rejected', color: colors.error[500], bgColor: colors.error[50] },
  revision_requested: { label: 'Revision Requested', color: colors.warning[500], bgColor: colors.warning[50] },
};

interface QuoteCardProps {
  quote: any;
  revisions?: any[];
  onAccept: () => void;
  onReject: () => void;
  onRequestRevision: () => void;
  onViewDetails: () => void;
}

export function QuoteCard({
  quote,
  revisions = [],
  onAccept,
  onReject,
  onRequestRevision,
  onViewDetails,
}: QuoteCardProps) {
  const [showRevisions, setShowRevisions] = useState(false);
  
  const statusConfig = QUOTE_STATUS_CONFIG[quote.status as keyof typeof QUOTE_STATUS_CONFIG] || QUOTE_STATUS_CONFIG.submitted;
  const hasRevisions = revisions.length > 0;

  return (
    <View style={styles.card}>
      {/* Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
        <Text style={[styles.statusText, { color: statusConfig.color }]}>
          {statusConfig.label}
        </Text>
        {quote.revision_number > 0 && (
          <Text style={[styles.revisionNumber, { color: statusConfig.color }]}>
            • Rev {quote.revision_number}
          </Text>
        )}
      </View>

      {/* Vendor Info */}
      <View style={styles.header}>
        <View style={styles.vendor}>
          <Ionicons name="person-circle" size={40} color={colors.gray[400]} />
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
            <Text style={styles.vendorPhone}>{quote.vendor?.phone}</Text>
          </View>
        </View>
        <View style={styles.amount}>
          <Text style={styles.amountLabel}>Quote</Text>
          <Text style={styles.amountValue}>R {quote.total_amount?.toLocaleString()}</Text>
        </View>
      </View>

      {/* Notes */}
      {quote.notes && (
        <Text style={styles.notes} numberOfLines={2}>
          {quote.notes}
        </Text>
      )}

      {/* Details */}
      <View style={styles.details}>
        {quote.estimated_duration && (
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={14} color={colors.gray[500]} />
            <Text style={styles.detailText}>{quote.estimated_duration}</Text>
          </View>
        )}
        {quote.warranty_period && (
          <View style={styles.detailItem}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.gray[500]} />
            <Text style={styles.detailText}>{quote.warranty_period}</Text>
          </View>
        )}
      </View>

      {/* Revision History Toggle */}
      {hasRevisions && (
        <TouchableOpacity
          style={styles.revisionToggle}
          onPress={() => setShowRevisions(!showRevisions)}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={RSA.blue}
          />
          <Text style={styles.revisionToggleText}>
            {showRevisions ? 'Hide' : 'Show'} Revision History ({revisions.length})
          </Text>
          <Ionicons
            name={showRevisions ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={RSA.blue}
          />
        </TouchableOpacity>
      )}

      {/* Revision History */}
      {showRevisions && hasRevisions && (
        <View style={styles.revisionHistory}>
          {revisions.map((revision, index) => (
            <View key={revision.id} style={styles.revisionItem}>
              <View style={styles.revisionHeader}>
                <View style={styles.revisionBadge}>
                  <Text style={styles.revisionBadgeText}>v{revision.revision_number}</Text>
                </View>
                <Text style={styles.revisionDate}>
                  {new Date(revision.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.revisionAmount}>
                <Text style={styles.revisionAmountLabel}>Amount:</Text>
                <Text style={styles.revisionAmountValue}>
                  R {revision.total_amount?.toLocaleString()}
                </Text>
                {index < revisions.length - 1 && (
                  <View style={styles.revisionDiff}>
                    <Ionicons
                      name={revision.total_amount > revisions[index + 1].total_amount ? 'arrow-up' : 'arrow-down'}
                      size={12}
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
                <Text style={styles.revisionReason}>{revision.revision_reason}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Actions for submitted quotes */}
      {quote.status === 'submitted' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={onReject}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.error[600]} />
            <Text style={styles.rejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.revisionButton]}
            onPress={onRequestRevision}
          >
            <Ionicons name="create-outline" size={18} color={colors.warning[600]} />
            <Text style={styles.revisionText}>Request Changes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={onAccept}
          >
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* View Details */}
      <TouchableOpacity style={styles.viewDetails} onPress={onViewDetails}>
        <Text style={styles.viewDetailsText}>View Full Details</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  revisionNumber: {
    fontSize: 11,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  vendor: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  vendorInfo: {
    flex: 1,
  },
  vendorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  vendorPhone: {
    fontSize: 13,
    color: colors.gray[600],
  },
  contractBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.info[50],
    borderRadius: 4,
  },
  contractBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.info[700],
  },
  amount: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    fontSize: 12,
    color: colors.gray[500],
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: RSA.blue,
  },
  notes: {
    fontSize: 14,
    color: colors.gray[700],
    lineHeight: 20,
    marginBottom: 12,
  },
  details: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: colors.gray[600],
  },
  revisionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 4,
  },
  revisionToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: RSA.blue,
    flex: 1,
  },
  revisionHistory: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  revisionItem: {
    backgroundColor: colors.gray[50],
    padding: 12,
    borderRadius: 8,
  },
  revisionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  revisionBadge: {
    backgroundColor: colors.gray[200],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  revisionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray[700],
  },
  revisionDate: {
    fontSize: 12,
    color: colors.gray[600],
  },
  revisionAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  revisionAmountLabel: {
    fontSize: 12,
    color: colors.gray[600],
  },
  revisionAmountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  revisionDiff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  revisionDiffText: {
    fontSize: 12,
    fontWeight: '600',
  },
  revisionReason: {
    fontSize: 12,
    color: colors.gray[700],
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  rejectButton: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.error[500],
  },
  rejectText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error[600],
  },
  revisionButton: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.warning[500],
  },
  revisionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning[600],
  },
  acceptButton: {
    backgroundColor: RSA.blue,
    borderColor: RSA.blue,
  },
  acceptText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 8,
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[600],
  },
});
