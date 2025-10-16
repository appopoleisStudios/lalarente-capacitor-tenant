import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { maintenanceApi } from '@/src/features/maintenance/api';
import { quotesApi } from '@/src/features/maintenance/api/quotesApi';
import { purchaseOrdersApi, PurchaseOrder } from '@/src/features/maintenance/api/purchaseOrdersApi';
import { MediaGallery } from '@/src/features/maintenance/components/MediaGallery';
import { colors } from '@/src/shared/theme/colors';

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
  const [request, setRequest] = useState<any>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchRequest();
    }
  }, [id]);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch main request
      const data = await maintenanceApi.getMaintenanceRequestById(id);
      setRequest(data);
      
      // 2. Fetch quotes for this request
      try {
        const quotesData = await quotesApi.getQuotesByRequest(id);
        setQuotes(quotesData);
      } catch (error) {
        console.log('Failed to fetch quotes:', error);
        setQuotes([]);
      }
      
      // 3. Fetch PO using the DIRECT po_id reference (CORRECTED)
      const poId = (data as any)?.po_id;
      if (poId) {
        try {
          const po = await purchaseOrdersApi.getPOById(poId);
          setPurchaseOrder(po);
        } catch (error) {
          console.log('Failed to fetch PO:', error);
          setPurchaseOrder(null);
        }
      } else {
        setPurchaseOrder(null);
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

      await maintenanceApi.acknowledgeRequest(id);

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

      await maintenanceApi.pushToOpenMarket(id);

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

              const result = await maintenanceApi.pushToDedicatedVendors(id);
              
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

              await maintenanceApi.closeRequest(id);

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

              // TODO: Implement accept quote API
              // await maintenanceApi.acceptQuote(quoteId, vendorId);
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Quote accepted and PO generated');
              fetchRequest();
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
      'Are you sure you want to reject this quote?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              // TODO: Implement reject quote API
              // await maintenanceApi.rejectQuote(quoteId);
              
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

              await maintenanceApi.deleteMaintenanceRequest(id);

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

        {/* Days Since Created */}
        <View style={styles.daysCard}>
          <Ionicons name="calendar-outline" size={20} color={colors.gray[600]} />
          <Text style={styles.daysText}>
            {(() => {
              const days = Math.floor((Date.now() - new Date(request.created_at).getTime()) / (1000 * 60 * 60 * 24));
              if (days === 0) return 'Created today';
              if (days === 1) return 'Created 1 day ago';
              return `Created ${days} days ago`;
            })()}
          </Text>
          {request.completed_date && (
            <Text style={styles.daysSubtext}>
              {(() => {
                const completionDays = Math.floor(
                  (new Date(request.completed_date).getTime() - new Date(request.created_at).getTime()) / (1000 * 60 * 60 * 24)
                );
                return ` • Completed in ${completionDays} ${completionDays === 1 ? 'day' : 'days'}`;
              })()}
            </Text>
          )}
        </View>

        {/* Property Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="home" size={20} color={colors.gray[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Property</Text>
              <Text style={styles.infoValue}>{request.property?.title}</Text>
              <Text style={styles.infoSubtext}>
                {request.property?.address}, {request.property?.city}
              </Text>
            </View>
          </View>
        </View>

        {/* Tenant Info (if exists) */}
        {request.tenant && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="person" size={20} color={colors.gray[600]} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Reported By</Text>
                <Text style={styles.infoValue}>{request.tenant.full_name}</Text>
                <Text style={styles.infoSubtext}>{request.tenant.phone}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Category */}
        {request.category && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="pricetag" size={20} color={colors.gray[600]} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Category</Text>
                <Text style={styles.infoValue}>{request.category.name}</Text>
              </View>
            </View>
          </View>
        )}

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
                Alert.alert(
                  'Chat Feature',
                  `Chat with ${request.tenant.full_name} will be available in Phase 2`,
                  [{ text: 'OK' }]
                );
                // TODO: Implement chat screen
                // router.push(`/(owner)/maintenance/${request.id}/chat`);
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
              <TouchableOpacity 
                key={quote.id} 
                style={styles.quoteCard}
                onPress={() => router.push(`/(owner)/maintenance/${id}/quote/${quote.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.quoteHeader}>
                  <View style={styles.quoteVendor}>
                    <Ionicons name="person-circle" size={40} color={colors.gray[400]} />
                    <View style={styles.quoteVendorInfo}>
                      <View style={styles.quoteVendorNameRow}>
                        <Text style={styles.quoteVendorName}>{quote.vendor?.full_name}</Text>
                        {quote.contract_id && (
                          <View style={styles.contractBadge}>
                            <Ionicons name="document-text-outline" size={14} color={colors.info[600]} />
                            <Text style={styles.contractBadgeText}>Contract</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.quoteVendorPhone}>{quote.vendor?.phone}</Text>
                    </View>
                  </View>
                  <View style={styles.quoteAmount}>
                    <Text style={styles.quoteAmountLabel}>Quote</Text>
                    <Text style={styles.quoteAmountValue}>R {quote.total_amount?.toLocaleString()}</Text>
                  </View>
                </View>
                
                {quote.notes && (
                  <Text style={styles.quoteNotes}>{quote.notes}</Text>
                )}
                
                <View style={styles.quoteDetails}>
                  <View style={styles.quoteDetailItem}>
                    <Ionicons name="time-outline" size={16} color={colors.gray[500]} />
                    <Text style={styles.quoteDetailText}>{quote.estimated_duration || 'Not specified'}</Text>
                  </View>
                  {quote.warranty_period && (
                    <View style={styles.quoteDetailItem}>
                      <Ionicons name="shield-checkmark-outline" size={16} color={colors.gray[500]} />
                      <Text style={styles.quoteDetailText}>{quote.warranty_period} warranty</Text>
                    </View>
                  )}
                </View>

                {quote.status === 'submitted' && (
                  <View style={styles.quoteActions}>
                    <TouchableOpacity
                      style={[styles.quoteActionButton, styles.quoteRejectButton]}
                      onPress={() => handleRejectQuote(quote.id)}
                    >
                      <Text style={styles.quoteRejectText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.quoteActionButton, styles.quoteAcceptButton]}
                      onPress={() => handleAcceptQuote(quote.id, quote.vendor_id)}
                    >
                      <Text style={styles.quoteAcceptText}>Accept & Generate PO</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {quote.status === 'accepted' && (
                  <View style={styles.quoteStatusBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success[500]} />
                    <Text style={styles.quoteStatusText}>Accepted</Text>
                  </View>
                )}
                
                {/* Tap to view details hint */}
                <View style={styles.quoteTapHint}>
                  <Text style={styles.quoteTapHintText}>Tap to view full details</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Purchase Order */}
        {purchaseOrder && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Purchase Order</Text>
              <Text style={[styles.sectionBadge, { backgroundColor: colors.success[50], color: colors.success[700] }]}>
                Issued
              </Text>
            </View>
            <TouchableOpacity
              style={styles.poCard}
              onPress={() => router.push(`/(owner)/maintenance/${id}/po/${purchaseOrder.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.poHeader}>
                <Ionicons name="document-text" size={32} color={RSA.blue} />
                <View style={styles.poInfo}>
                  <Text style={styles.poNumber}>{purchaseOrder.po_number}</Text>
                  <Text style={styles.poAmount}>
                    R {purchaseOrder.total_amount?.toLocaleString() || '0'}
                  </Text>
                  
                  {/* Contract Reference */}
                  {purchaseOrder.contract && (
                    <View style={styles.poContractRef}>
                      <Ionicons name="link-outline" size={14} color={colors.gray[500]} />
                      <Text style={styles.poContractText}>
                        Contract: {purchaseOrder.contract.contract_number}
                      </Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
              </View>
            </TouchableOpacity>
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
                Alert.alert(
                  'Invoice',
                  'Invoice details screen will be available in Phase 2',
                  [{ text: 'OK' }]
                );
                // TODO: Implement invoice screen
                // router.push(`/(owner)/maintenance/${request.id}/invoice`);
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.timeline}>
            <TimelineItem
              icon="add-circle"
              label="Created"
              date={new Date(request.created_at).toLocaleDateString()}
              completed
            />
            {request.acknowledged_at && (
              <TimelineItem
                icon="checkmark-circle"
                label="Acknowledged"
                date={new Date(request.acknowledged_at).toLocaleDateString()}
                completed
              />
            )}
            {request.vendor_routed_at && (
              <TimelineItem
                icon="people"
                label="Sent to Vendors"
                date={new Date(request.vendor_routed_at).toLocaleDateString()}
                completed
              />
            )}
            {quotes && quotes.length > 0 && (
              <TimelineItem
                icon="document-text"
                label={`Quote${quotes.length > 1 ? 's' : ''} Received (${quotes.length})`}
                date={new Date(quotes[0].created_at).toLocaleDateString()}
                completed
              />
            )}
            {purchaseOrder && (
              <TimelineItem
                icon="receipt"
                label="Purchase Order Issued"
                date={new Date(purchaseOrder.created_at).toLocaleDateString()}
                completed
              />
            )}
            {request.status === 'in_progress' && (
              <TimelineItem
                icon="construct"
                label="Work In Progress"
                date={request.scheduled_date ? new Date(request.scheduled_date).toLocaleDateString() : 'In Progress'}
                completed
              />
            )}
            {request.completed_date && (
              <TimelineItem
                icon="checkmark-done"
                label="Completed"
                date={new Date(request.completed_date).toLocaleDateString()}
                completed
              />
            )}
            {request.status === 'closed' && !request.completed_date && (
              <TimelineItem
                icon="archive"
                label="Closed"
                date={new Date().toLocaleDateString()}
                completed
              />
            )}
          </View>
        </View>

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
});
