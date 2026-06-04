import { useAuth } from '@/src/contexts/AuthContext';
import {
  acceptQuote,
  acknowledgeRequest,
  approveClosureReport,
  getClosureReport,
  getMaintenanceRequestById,
  getPOByRequestId,
  getQuotesByRequest,
  pushToDedicatedVendors,
  pushToOpenMarket,
  rejectClosureReport,
  rejectQuote,
  requestQuoteRevision,
  type ClosureReport,
  type PurchaseOrder
} from '@/src/features/maintenance/api';
import { MediaGallery } from '@/src/features/maintenance/components/MediaGallery';
import {
  QuoteCard,
  RequestInfoSection,
  RequestPOSection,
  RequestTimelineSection,
} from '@/src/features/owner/components';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RSA = { blue: '#002395' };

const STATUS_CONFIG = {
  open: { label: 'Open', color: colors.error[500], icon: 'alert-circle' },
  assigned: { label: 'Assigned', color: colors.warning[500], icon: 'person' },
  in_progress: { label: 'In Progress', color: colors.info[500], icon: 'time' },
  completed: { label: 'Completed', color: colors.success[500], icon: 'checkmark-circle' },
  closed: { label: 'Closed', color: colors.gray[500], icon: 'archive' },
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: colors.success[500], icon: 'arrow-down-circle' },
  medium: { label: 'Medium', color: colors.warning[500], icon: 'remove-circle' },
  high: { label: 'High', color: colors.error[500], icon: 'arrow-up-circle' },
};

export default function OwnerMaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [request, setRequest] = useState<any>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [quoteRevisions, setQuoteRevisions] = useState<Record<string, any[]>>({});
  const [expandedQuotes, setExpandedQuotes] = useState<Record<string, boolean>>({});
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [closureReport, setClosureReport] = useState<ClosureReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchRequest();
    }
  }, [id]);

  // Refetch data when screen comes into focus (e.g., after navigating back)
  useFocusEffect(
    React.useCallback(() => {
      if (id) {
        console.log('🔄 Screen focused - refetching data...');
        fetchRequest();
      }
      return () => {
        console.log('👋 Screen unfocused');
      };
    }, [id])
  );

  const fetchRequest = async () => {
    try {
      setLoading(true);

      // 1. Fetch main request
      const data = await getMaintenanceRequestById(id);
      setRequest(data);

      // 2. Fetch quotes for this request
      try {
        const quotesData = await getQuotesByRequest(id);
        setQuotes(quotesData);

        // 2b. Fetch revisions for each quote
        const revisionsMap: Record<string, any[]> = {};
        for (const quote of quotesData) {
          try {
            const { getQuoteRevisions } = await import('@/src/features/maintenance/api');
            const revisions = await getQuoteRevisions(quote.id);
            if (revisions && revisions.length > 0) {
              revisionsMap[quote.id] = revisions;
            }
          } catch (error) {
            console.log(`Failed to fetch revisions for quote ${quote.id}:`, error);
          }
        }
        setQuoteRevisions(revisionsMap);
      } catch (error) {
        console.log('Failed to fetch quotes:', error);
        setQuotes([]);
      }

      // 3. Fetch PO using the DIRECT po_id reference (CORRECTED)
      const poId = (data as any)?.po_id;
      if (poId) {
        try {
          const po = await getPOByRequestId(id) || await (await import('@/src/features/maintenance/api')).getPOById(poId);
          setPurchaseOrder(po);
        } catch (error) {
          console.log('Failed to fetch PO:', error);
          setPurchaseOrder(null);
        }
      } else {
        setPurchaseOrder(null);
      }

      // 4. Fetch closure report if job is in progress or completed
      try {
        const closure = await getClosureReport(id);
        setClosureReport(closure);
      } catch (error) {
        console.log('Failed to fetch closure report:', error);
        setClosureReport(null);
      }

    } catch (error: any) {
      console.error('Error fetching request:', error);
      Alert.alert('Error', 'Failed to load request details');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    try {
      setActionLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await acknowledgeRequest(id);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Request acknowledged');
      fetchRequest(); // Refresh
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to acknowledge request');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePushToVendors = () => {
    Alert.alert(
      'Push to Vendors',
      'How would you like to route this request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Market',
          onPress: () => handlePushToOpenMarket(),
        },
        {
          text: 'Dedicated Vendors',
          onPress: () => handleSendToDedicatedVendors(),
        },
      ]
    );
  };

  const handlePushToOpenMarket = async () => {
    try {
      setActionLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await pushToOpenMarket(id);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Request pushed to open market. All vendors in this category can now see and quote on this request.');
      fetchRequest(); // Refresh
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to push to open market');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendToDedicatedVendors = async () => {
    Alert.alert(
      'Send to Dedicated Vendors',
      'This will send the request to your dedicated vendors for this property. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              const result = await pushToDedicatedVendors(id);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                'Success',
                `Request sent to ${result.vendorsNotified} dedicated vendor${result.vendorsNotified !== 1 ? 's' : ''}`
              );
              fetchRequest();
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to send to vendors');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleClose = async () => {
    Alert.alert(
      'Close Request',
      'Are you sure you want to close this request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              const { closeRequest } = await import('@/src/features/maintenance/api');
              await closeRequest(id);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              // Refresh the request to show updated status
              fetchRequest();
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to close request');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAcceptQuote = async (quoteId: string, vendorId: string) => {
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

              // Accept the quote (new function handles everything including PO generation)
              if (!user?.id) {
                throw new Error('User not authenticated');
              }

              const result = await acceptQuote(quoteId, user.id);
              console.log('✅ Quote acceptance result:', result);
              console.log('✅ PO ID:', result?.po?.id);

              if (!result?.po?.id) {
                throw new Error('PO was not created successfully');
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              // Refresh the current screen data before navigating
              await fetchRequest();

              // Redirect to PO detail screen
              console.log('🔄 Navigating to PO screen:', `/(owner)/maintenance/${id}/po/${result.po.id}`);
              router.push(`/(owner)/maintenance/${id}/po/${result.po.id}`);
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

  const handleRejectQuote = async (quoteId: string) => {
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

              await rejectQuote(quoteId, user.id);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Quote rejected');
              fetchRequest();
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

  const handleRequestRevision = (quoteId: string) => {
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
              fetchRequest();
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

  const handleApproveClosure = () => {
    Alert.alert(
      'Approve Job Completion',
      'By approving, you confirm the work has been completed satisfactorily. The job will be marked as completed. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              if (!user?.id) {
                throw new Error('User not authenticated');
              }

              await approveClosureReport(id, user.id);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Job marked as completed successfully');
              fetchRequest();
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to approve closure');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRejectClosure = () => {
    Alert.prompt(
      'Request Changes',
      'Please explain what needs to be fixed or improved:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          style: 'destructive',
          onPress: async (reason?: string) => {
            if (!reason || reason.trim() === '') {
              Alert.alert('Error', 'Please provide a reason for rejection');
              return;
            }

            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              if (!user?.id) {
                throw new Error('User not authenticated');
              }

              await rejectClosureReport(id, user.id, reason.trim());

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Closure rejected. The vendor will be notified.');
              fetchRequest();
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to reject closure');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const toggleQuoteExpanded = (quoteId: string) => {
    setExpandedQuotes(prev => ({
      ...prev,
      [quoteId]: !prev[quoteId]
    }));
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Request',
      'Are you sure you want to delete this request? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

              const { deleteMaintenanceRequest } = await import('@/src/features/maintenance/api');
              await deleteMaintenanceRequest(id);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              // Navigate back
              router.back();

              // Show success after navigation
              setTimeout(() => {
                Alert.alert('Deleted', 'Request has been deleted');
              }, 300);
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to delete request');
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
          <Text style={styles.loadingText}>Loading details...</Text>
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

  const statusConfig = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG];
  const priorityConfig = PRIORITY_CONFIG[request.priority as keyof typeof PRIORITY_CONFIG];
  const canAcknowledge = request.mms_status === 'notification' && !request.acknowledged_at;
  const canPushToVendors = request.acknowledged_at && !request.vendor_routed_at;

  // Edge case: Request is in open market but no quotes received
  const isUnquotedOpenMarket = request.acknowledged_at &&
    request.vendor_routed_at &&
    request.visibility === 'public' &&
    (!quotes || quotes.length === 0) &&
    request.status === 'open';

  // Can send to dedicated vendors if acknowledged and no PO issued yet
  const canSendToDedicatedVendors = request.acknowledged_at && !purchaseOrder;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            // Navigate back to maintenance list instead of using router.back()
            // which can go to dashboard
            if (router.canGoBack()) {
              router.push('/(owner)/maintenance');
            } else {
              router.back();
            }
          }}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Actions', 'Choose an action', [
              {
                text: 'Close Request',
                onPress: handleClose,
                style: 'default',
              },
              {
                text: 'Delete Request',
                onPress: handleDelete,
                style: 'destructive',
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
          style={styles.headerButton}
        >
          <Ionicons name="ellipsis-vertical" size={24} color="#111827" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Status & Priority */}
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: statusConfig.color }]}>
            <Ionicons name={statusConfig.icon as any} size={16} color="#FFFFFF" />
            <Text style={styles.badgeText}>{statusConfig.label}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: priorityConfig.color }]}>
            <Ionicons name={priorityConfig.icon as any} size={16} color="#FFFFFF" />
            <Text style={styles.badgeText}>{priorityConfig.label}</Text>
          </View>
        </View>

        {/* Title & Request Number */}
        <View style={styles.titleContainer}>
          <Text style={styles.requestNumber}>#{request.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.title}>{request.title}</Text>
        </View>

        {/* Request Info Section */}
        <RequestInfoSection request={request} />

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{request.description}</Text>
        </View>

        {/* Photos/Videos */}
        {request.images && request.images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Photos & Videos ({request.images.length})
            </Text>
            <MediaGallery images={request.images} />
          </View>
        )}

        {/* Communication */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Communication</Text>
            <Text style={styles.sectionBadge}>
              {request.tenant ? 'With Tenant' : 'No messages'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => {
              if (request.tenant) {
                router.push('/(owner)/messages' as any);
              } else {
                Alert.alert('No Tenant', 'This request has no tenant assigned');
              }
            }}
          >
            <View style={styles.chatButtonContent}>
              <Ionicons name="chatbubbles" size={24} color={RSA.blue} />
              <View style={styles.chatButtonText}>
                <Text style={styles.chatButtonTitle}>
                  {request.tenant ? `Chat with ${request.tenant.full_name}` : 'No tenant assigned'}
                </Text>
                <Text style={styles.chatButtonSubtitle}>
                  Discuss request details and updates
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Vendor Quotes */}
        {quotes && quotes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Vendor Quotes</Text>
              <Text style={styles.sectionBadge}>{quotes.length} received</Text>
            </View>
            {quotes.map((quote: any) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                revisions={quoteRevisions[quote.id] || []}
                onAccept={() => handleAcceptQuote(quote.id, quote.vendor_id)}
                onReject={() => handleRejectQuote(quote.id)}
                onRequestRevision={() => handleRequestRevision(quote.id)}
                onViewDetails={() => router.push(`/(owner)/maintenance/${id}/quote/${quote.id}`)}
              />
            ))}
          </View>
        )}

        {/* Purchase Order */}
        <RequestPOSection
          purchaseOrder={purchaseOrder}
          requestId={id}
          onPress={() => purchaseOrder && router.push(`/(owner)/maintenance/${id}/po/${purchaseOrder.id}`)}
          onSendPO={() => purchaseOrder && router.push(`/(owner)/maintenance/${id}/po/${purchaseOrder.id}`)}
        />

        {/* Closure Request */}
        {closureReport && closureReport.status === 'pending' && (
          <View style={styles.section}>
            <View style={styles.closureBanner}>
              <View style={styles.closureBannerHeader}>
                <Ionicons name="checkmark-done-circle" size={28} color={colors.success[500]} />
                <Text style={styles.closureBannerTitle}>
                  🏁 Vendor has requested job closure
                </Text>
              </View>
              <Text style={styles.closureBannerSubtitle}>
                Review the completion notes and photos below, then approve or request changes.
              </Text>
            </View>

            <View style={styles.closureContent}>
              <Text style={styles.closureLabel}>Completion Notes</Text>
              <View style={styles.closureNotesCard}>
                <Text style={styles.closureNotesText}>
                  {closureReport.completion_notes || 'No notes provided'}
                </Text>
              </View>

              <Text style={styles.closureLabel}>Completion Photos</Text>
              <MediaGallery images={closureReport.completion_photos || []} />

              <View style={styles.closureActions}>
                <TouchableOpacity
                  style={[styles.closureButton, styles.closureRejectButton]}
                  onPress={handleRejectClosure}
                  disabled={actionLoading}
                >
                  <Ionicons name="close-circle" size={20} color={colors.error[600]} />
                  <Text style={styles.closureRejectButtonText}>Request Changes</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.closureButton, styles.closureApproveButton]}
                  onPress={handleApproveClosure}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      <Text style={styles.closureApproveButtonText}>Approve & Complete</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Invoice */}
        {request.status === 'completed' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Invoice</Text>
              <Text style={[styles.sectionBadge, { backgroundColor: colors.warning[50], color: colors.warning[700] }]}>
                Pending Payment
              </Text>
            </View>
            <TouchableOpacity
              style={styles.invoiceCard}
              onPress={() => {
                router.push('/(owner)/invoices' as any);
              }}
            >
              <View style={styles.invoiceHeader}>
                <Ionicons name="receipt" size={32} color={colors.warning[500]} />
                <View style={styles.invoiceInfo}>
                  <Text style={styles.invoiceTitle}>Final Invoice</Text>
                  <Text style={styles.invoiceAmount}>
                    R {request.actual_cost?.toLocaleString() || '0'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Timeline */}
        <RequestTimelineSection request={request} quotes={quotes} purchaseOrder={purchaseOrder} />

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Action Buttons */}
      {(canAcknowledge || canPushToVendors || isUnquotedOpenMarket) && (
        <View style={styles.footer}>
          {canAcknowledge && (
            <View style={styles.actionContainer}>
              <Text style={styles.actionHint}>
                📋 Acknowledge to confirm you've reviewed this request
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handleAcknowledge}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Acknowledge Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
          {canPushToVendors && (
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={handlePushToVendors}
              disabled={actionLoading}
            >
              <Ionicons name="people" size={20} color={RSA.blue} />
              <Text style={[styles.actionButtonText, { color: RSA.blue }]}>
                Push to Vendors
              </Text>
            </TouchableOpacity>
          )}
          {isUnquotedOpenMarket && (
            <View style={styles.actionContainer}>
              <Text style={styles.actionHint}>
                ⚠️ No quotes received yet. Send to your dedicated vendors?
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, styles.warningButton]}
                onPress={handleSendToDedicatedVendors}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Send to Dedicated Vendors</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  scrollView: { flex: 1 },
  badges: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  titleContainer: { paddingHorizontal: 16, marginTop: 16 },
  requestNumber: { fontSize: 13, fontWeight: '700', color: RSA.blue, letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  daysCard: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f0fdf4', borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  daysText: { fontSize: 14, fontWeight: '600', color: '#166534' },
  daysSubtext: { fontSize: 12, color: '#15803d' },
  infoCard: { marginHorizontal: 16, marginTop: 16, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  infoRow: { flexDirection: 'row', gap: 12 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  infoValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  infoSubtext: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  section: { marginHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  description: { fontSize: 15, color: '#374151', lineHeight: 22 },
  timeline: { gap: 16 },
  timelineItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  timelineIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.gray[200], justifyContent: 'center', alignItems: 'center' },
  timelineIconCompleted: { backgroundColor: RSA.blue },
  timelineContent: { flex: 1 },
  timelineLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  timelineDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  footer: { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 12 },
  actionContainer: { gap: 8 },
  actionHint: { fontSize: 13, color: '#6b7280', textAlign: 'center', paddingHorizontal: 16 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  primaryButton: { backgroundColor: RSA.blue },
  secondaryButton: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: RSA.blue },
  warningButton: { backgroundColor: colors.warning[500] },
  actionButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  // Section headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionBadge: { fontSize: 12, fontWeight: '600', color: colors.gray[600], backgroundColor: colors.gray[100], paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },

  // Chat button
  chatButton: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  chatButtonContent: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  chatButtonText: { flex: 1 },
  chatButtonTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 },
  chatButtonSubtitle: { fontSize: 13, color: '#6b7280' },

  // Quote cards
  quoteCard: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, marginBottom: 12 },
  quoteHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  quoteVendor: { flexDirection: 'row', gap: 12, flex: 1 },
  quoteVendorInfo: { justifyContent: 'center', flex: 1 },
  quoteVendorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  quoteVendorName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  quoteVendorPhone: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  contractBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.info[50], borderRadius: 12, borderWidth: 1, borderColor: colors.info[500] },
  contractBadgeText: { fontSize: 11, fontWeight: '600', color: colors.info[700] },
  quoteAmount: { alignItems: 'flex-end' },
  quoteAmountLabel: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  quoteAmountValue: { fontSize: 20, fontWeight: '700', color: RSA.blue },
  quoteNotes: { fontSize: 14, color: '#374151', marginBottom: 12, lineHeight: 20 },
  quoteDetails: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  quoteDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quoteDetailText: { fontSize: 13, color: '#6b7280' },
  quoteActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  quoteActionButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  quoteRejectButton: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2' },
  quoteRejectText: { fontSize: 14, fontWeight: '600', color: colors.error[600] },
  quoteAcceptButton: { backgroundColor: RSA.blue },
  quoteAcceptText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  quoteStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  quoteStatusText: { fontSize: 13, fontWeight: '600', color: colors.success[700] },
  quoteTapHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  quoteTapHintText: { fontSize: 13, color: colors.gray[500] },

  // PO card
  poCard: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  poHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  poInfo: { flex: 1 },
  poNumber: { fontSize: 16, fontWeight: '700', color: RSA.blue, marginBottom: 2 },
  poAmount: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 4 },
  poVendor: { fontSize: 14, color: '#6b7280' },
  poContractRef: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  poContractText: { fontSize: 12, color: colors.gray[600] },

  // Invoice card
  invoiceCard: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  invoiceHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  invoiceInfo: { flex: 1 },
  invoiceTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 },
  invoiceAmount: { fontSize: 20, fontWeight: '700', color: colors.warning[600] },

  // Closure section
  closureBanner: {
    backgroundColor: colors.success[50],
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.success[500],
    marginBottom: 16,
  },
  closureBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  closureBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.success[700],
    flex: 1,
  },
  closureBannerSubtitle: {
    fontSize: 14,
    color: colors.success[700],
    lineHeight: 20,
  },
  closureContent: {
    gap: 16,
  },
  closureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  closureNotesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  closureNotesText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  closureActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  closureButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  closureRejectButton: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.error[500],
  },
  closureRejectButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.error[600],
  },
  closureApproveButton: {
    backgroundColor: colors.success[500],
    borderColor: colors.success[500],
  },
  closureApproveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
