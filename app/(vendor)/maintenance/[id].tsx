import { useAuth } from '@/src/contexts/AuthContext';
import {
  getVendorRequestById,
  type VendorMaintenanceRequest
} from '@/src/features/maintenance/api';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RSA = { blue: '#002395', green: '#007A4D', gold: '#FFB81C', red: '#DE3831' };

// Priority badge configuration
const PRIORITY_CONFIG = {
  low: { label: 'Low', color: colors.gray[500], icon: 'arrow-down-circle' },
  medium: { label: 'Medium', color: colors.warning[500], icon: 'alert-circle' },
  high: { label: 'High', color: colors.error[500], icon: 'alert-circle' },
};

// Status badge configuration
const STATUS_CONFIG = {
  open: { label: 'Open', color: colors.info[500], icon: 'time-outline' },
  assigned: { label: 'Assigned', color: colors.warning[500], icon: 'checkmark-circle-outline' },
  in_progress: { label: 'In Progress', color: RSA.blue, icon: 'construct-outline' },
  completed: { label: 'Completed', color: colors.success[500], icon: 'checkmark-done-circle' },
  closed: { label: 'Closed', color: colors.gray[500], icon: 'close-circle' },
};

export default function VendorMaintenanceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [request, setRequest] = useState<VendorMaintenanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const fetchRequestDetails = useCallback(async () => {
    try {
      setLoading(true);
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      const data = await getVendorRequestById(id, user.id);
      setRequest(data);
    } catch (error: any) {
      console.error('Error fetching request:', error);
      Alert.alert('Error', 'Failed to load request details');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  // Refresh data when screen comes into focus (e.g., after submitting quote)
  useFocusEffect(
    useCallback(() => {
      if (id && user?.id) {
        fetchRequestDetails();
      }
    }, [id, user?.id, fetchRequestDetails])
  );

  const handleViewQuote = () => {
    if (request?.my_quote?.id) {
      router.push(`/(vendor)/maintenance/${id}/quote/${request.my_quote.id}`);
    }
  };

  const handleEditQuote = () => {
    if (request?.my_quote?.id) {
      // Navigate to edit screen with quote ID
      router.push(`/(vendor)/maintenance/${id}/quote/edit`);
    }
  };

  const handleSubmitQuote = () => {
    // Check if request is still open
    if (request?.status !== 'open') {
      Alert.alert(
        'Request Not Available',
        'This request is no longer accepting quotes.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check if vendor can quote
    if (!request?.can_quote) {
      Alert.alert(
        'Update Profile Required',
        'Your service categories do not match this request. Please update your profile to add the required category before submitting a quote.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Update Profile',
            onPress: () => router.push('/(vendor)/profile'),
            style: 'default'
          },
        ]
      );
      return;
    }

    // Check if this is an invited request
    if (request?.has_quote_request) {
      Alert.alert(
        'Invited to Quote',
        'You have been specifically invited to submit a quote for this request.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Submit Quote',
            onPress: () => router.push(`/(vendor)/maintenance/${id}/quote/new`),
            style: 'default'
          },
        ]
      );
      return;
    }

    // Navigate to quote submission screen
    router.push(`/(vendor)/maintenance/${id}/quote/new`);
  };

  const handleViewPO = () => {
    if (request?.po_id) {
      router.push(`/(vendor)/maintenance/${id}/po/${request.po_id}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RSA.blue} />
          <Text style={styles.loadingText}>Loading request...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.error[500]} />
          <Text style={styles.errorText}>Request not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const priorityConfig = PRIORITY_CONFIG[request.priority];
  const statusConfig = STATUS_CONFIG[request.status];
  const hasImages = request.images && request.images.length > 0;
  const hasQuote = !!request.my_quote;
  const canSubmitQuote = !hasQuote && request.status === 'open';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push('/(vendor)/maintenance');
            }
          }}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Status and Priority Badges */}
        <View style={styles.badgesContainer}>
          <View style={[styles.badge, { backgroundColor: priorityConfig.color }]}>
            <Ionicons name={priorityConfig.icon as any} size={16} color="#FFFFFF" />
            <Text style={styles.badgeText}>{priorityConfig.label}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusConfig.color }]}>
            <Ionicons name={statusConfig.icon as any} size={16} color="#FFFFFF" />
            <Text style={styles.badgeText}>{statusConfig.label}</Text>
          </View>
          {request.has_quote_request && (
            <View style={[styles.badge, { backgroundColor: RSA.gold }]}>
              <Ionicons name="mail" size={16} color="#FFFFFF" />
              <Text style={styles.badgeText}>Invited</Text>
            </View>
          )}
        </View>

        {/* Request ID and Date */}
        <View style={styles.section}>
          <Text style={styles.requestId}>#{request.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.dateText}>Created {formatDate(request.created_at)}</Text>
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.title}>{request.title}</Text>
        </View>

        {/* Property Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Property</Text>
          <View style={styles.propertyCard}>
            <View style={styles.propertyIcon}>
              <Ionicons name="home" size={24} color={RSA.green} />
            </View>
            <View style={styles.propertyInfo}>
              <Text style={styles.propertyTitle}>{request.property?.title || 'Property'}</Text>
              <Text style={styles.propertyAddress}>
                {request.property?.address || 'Address not available'}
              </Text>
              <Text style={styles.propertyCity}>
                {request.property?.city || ''}{request.property?.province ? `, ${request.property.province}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Category and Timeline */}
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Category</Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{request.category?.name || 'General'}</Text>
              </View>
            </View>
            {request.vendor_routed_at && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Routed</Text>
                <Text style={styles.infoValue}>{formatDate(request.vendor_routed_at)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionText}>{request.description}</Text>
          </View>
        </View>

        {/* Photos & Videos Gallery */}
        {hasImages && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos & Videos ({request.images!.length})</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.galleryScroll}
              contentContainerStyle={styles.galleryContent}
            >
              {request.images!.map((imageUrl, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.galleryItem,
                    selectedImageIndex === index && styles.galleryItemSelected,
                  ]}
                  onPress={() => setSelectedImageIndex(index)}
                >
                  <Image source={{ uri: imageUrl }} style={styles.galleryImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* Large preview of selected image */}
            <View style={styles.imagePreview}>
              <Image
                source={{ uri: request.images![selectedImageIndex] }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>
          </View>
        )}

        {/* My Quote Section (if exists) */}
        {hasQuote && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Quote</Text>
            <View style={styles.quoteCard}>
              <View style={styles.quoteHeader}>
                <View style={styles.quoteStatusContainer}>
                  <Text style={styles.quoteLabel}>Status</Text>
                  <View style={styles.quoteStatusBadge}>
                    <View
                      style={[
                        styles.quoteStatusDot,
                        {
                          backgroundColor:
                            request.my_quote!.status === 'approved'
                              ? colors.success[500]
                              : request.my_quote!.status === 'rejected'
                                ? colors.error[500]
                                : request.my_quote!.status === 'revision_requested'
                                  ? colors.warning[500]
                                  : colors.info[500],
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.quoteStatus,
                        {
                          color:
                            request.my_quote!.status === 'approved'
                              ? colors.success[600]
                              : request.my_quote!.status === 'rejected'
                                ? colors.error[600]
                                : request.my_quote!.status === 'revision_requested'
                                  ? colors.warning[600]
                                  : colors.info[600],
                        },
                      ]}
                    >
                      {request.my_quote!.status === 'approved'
                        ? 'Approved'
                        : request.my_quote!.status === 'rejected'
                          ? 'Rejected'
                          : request.my_quote!.status === 'revision_requested'
                            ? 'Revision Requested'
                            : request.my_quote!.status === 'submitted'
                              ? 'Submitted'
                              : 'Pending'}
                    </Text>
                  </View>
                </View>
                <View style={styles.quoteAmountContainer}>
                  <Text style={styles.quoteLabel}>Amount</Text>
                  <Text style={styles.quoteAmount}>
                    R {request.my_quote!.total_amount?.toLocaleString() || '0'}
                  </Text>
                </View>
              </View>

              {/* Quote submission date */}
              <View style={styles.quoteMetaRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.gray[500]} />
                <Text style={styles.quoteMetaText}>
                  Submitted {formatDate(request.my_quote!.created_at)}
                </Text>
              </View>

              {/* Revision reason if requested */}
              {request.my_quote!.status === 'revision_requested' && request.my_quote!.revision_reason && (
                <View style={styles.revisionReasonContainer}>
                  <Ionicons name="information-circle" size={16} color={colors.warning[600]} />
                  <Text style={styles.revisionReasonLabel}>Owner's feedback:</Text>
                  <Text style={styles.revisionReasonText}>{request.my_quote!.revision_reason}</Text>
                </View>
              )}

              {/* Action buttons */}
              <View style={styles.quoteActionsRow}>
                {request.my_quote!.status === 'revision_requested' && (
                  <TouchableOpacity style={styles.editQuoteButton} onPress={handleEditQuote}>
                    <Ionicons name="create" size={20} color="#FFFFFF" />
                    <Text style={styles.editQuoteButtonText}>Revise Quote</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* PO Details (if quote accepted) */}
        {request.po_id && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Purchase Order</Text>
            <TouchableOpacity style={styles.poCard} onPress={handleViewPO}>
              <View style={styles.poIcon}>
                <Ionicons name="document-text" size={24} color={RSA.blue} />
              </View>
              <View style={styles.poInfo}>
                <Text style={styles.poLabel}>PO Issued</Text>
                <Text style={styles.poNumber}>PO-{request.po_id.slice(0, 8).toUpperCase()}</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.gray[400]} />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action Button */}
      {canSubmitQuote && (
        <View style={styles.bottomBar}>
          {!request.can_quote && (
            <View style={styles.warningBanner}>
              <Ionicons name="information-circle" size={20} color={colors.warning[600]} />
              <Text style={styles.warningText}>
                Update your profile to add this category before quoting
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.submitButton,
              !request.can_quote && styles.submitButtonDisabled
            ]}
            onPress={handleSubmitQuote}
            disabled={!request.can_quote}
          >
            <Ionicons name="document-text" size={24} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>
              {request.can_quote ? 'Submit Quote' : 'Update Profile to Quote'}
            </Text>
          </TouchableOpacity>
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
    borderBottomColor: '#e5e7eb',
  },
  headerButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },

  scrollView: { flex: 1 },

  badgesContainer: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 20 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  badgeText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  section: { marginHorizontal: 16, marginTop: 20 },
  requestId: { fontSize: 14, fontWeight: '700', color: colors.gray[600], letterSpacing: 0.5 },
  dateText: { fontSize: 13, color: colors.gray[500], marginTop: 4 },

  title: { fontSize: 24, fontWeight: '700', color: '#111827', lineHeight: 32 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },

  propertyCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  propertyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.success[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  propertyInfo: { flex: 1 },
  propertyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  propertyAddress: { fontSize: 14, color: '#6b7280', marginBottom: 2 },
  propertyCity: { fontSize: 13, color: '#9ca3af' },

  infoRow: { flexDirection: 'row', gap: 16 },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 6 },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
  categoryBadge: {
    backgroundColor: colors.info[50],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  categoryText: { fontSize: 14, fontWeight: '600', color: colors.info[700] },

  descriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  descriptionText: { fontSize: 15, color: '#374151', lineHeight: 22 },

  galleryScroll: { marginBottom: 12 },
  galleryContent: { paddingRight: 16 },
  galleryItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  galleryItemSelected: { borderColor: RSA.blue },
  galleryImage: { width: '100%', height: '100%' },
  imagePreview: {
    width: '100%',
    height: 240,
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },

  quoteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  quoteHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  quoteLabel: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  quoteStatusContainer: { flex: 1 },
  quoteStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quoteStatusDot: { width: 8, height: 8, borderRadius: 4 },
  quoteStatus: { fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },
  quoteAmountContainer: { alignItems: 'flex-end' },
  quoteAmount: { fontSize: 20, fontWeight: '700', color: RSA.green },
  quoteMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  quoteMetaText: { fontSize: 13, color: colors.gray[600] },
  revisionReasonContainer: {
    backgroundColor: colors.warning[50],
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning[500],
  },
  revisionReasonLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.warning[700],
    marginTop: 4,
    marginBottom: 4,
  },
  revisionReasonText: {
    fontSize: 14,
    color: colors.warning[700],
    lineHeight: 20,
  },
  quoteActionsRow: {
    gap: 8,
  },
  viewQuoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.info[50],
    borderRadius: 8,
  },
  viewQuoteButtonText: { fontSize: 15, fontWeight: '700', color: RSA.blue },
  editQuoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: RSA.blue,
    borderRadius: 8,
  },
  editQuoteButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  poCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  poIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.info[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  poInfo: { flex: 1 },
  poLabel: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  poNumber: { fontSize: 16, fontWeight: '700', color: '#111827' },

  bottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warning[50],
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: colors.warning[700],
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: RSA.blue,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray[400],
    opacity: 0.6,
  },
  submitButtonText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
