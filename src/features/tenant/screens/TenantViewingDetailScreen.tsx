import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { viewingsApi, ViewingWithRelations, RequestViewingInput } from '../../properties/api/viewingsApi';
import { supabase } from '../../../lib/supabase';

const RSA = { green: '#007A4D', gold: '#FFB81C' };

const parseAlternativeTime = (alt: string) => {
  // Handle structured ISO-ish format "YYYY-MM-DDThh:mm"
  if (alt.includes('T')) {
    const [datePart, timePart] = alt.split('T');
    const date = new Date(datePart + 'T00:00:00');
    return {
      date: date.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }),
      time: timePart,
      isoDate: datePart,
      isoTime: timePart,
    };
  }
  // Fallback for legacy plain text
  return { date: alt, time: '', isoDate: '', isoTime: '' };
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return '#FF9800';
    case 'approved':
      return '#4CAF50';
    case 'declined':
      return '#F44336';
    case 'completed':
      return '#2196F3';
    case 'cancelled':
      return '#999';
    default:
      return '#999';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return 'time-outline';
    case 'approved':
      return 'checkmark-circle';
    case 'declined':
      return 'close-circle';
    case 'completed':
      return 'checkmark-done-circle';
    case 'cancelled':
      return 'ban';
    default:
      return 'help-circle';
  }
};

export default function TenantViewingDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const viewingId = params.id as string;

  const [viewing, setViewing] = useState<ViewingWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [acceptedSlot, setAcceptedSlot] = useState<string | null>(null);
  const [hasNewPending, setHasNewPending] = useState(false);

  useEffect(() => {
    loadViewing();
  }, [viewingId]);

  const loadViewing = async () => {
    try {
      const data = await viewingsApi.getViewing(viewingId);
      setViewing(data);

      // If this viewing is declined, check if tenant already has a newer pending/approved
      // request for the same property — if so, lock the alternative slots
      if (data.status === 'declined') {
        const { data: newer } = await supabase
          .from('viewing_requests')
          .select('id')
          .eq('tenant_id', data.tenant_id)
          .eq('property_id', data.property_id)
          .in('status', ['pending', 'approved'])
          .limit(1);

        if (newer && newer.length > 0) {
          setHasNewPending(true);
        }
      }
    } catch (error) {
      console.error('Error loading viewing:', error);
      Alert.alert('Error', 'Failed to load viewing details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Viewing',
      'Are you sure you want to cancel this viewing request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: confirmCancel,
        },
      ]
    );
  };

  const confirmCancel = async () => {
    if (!viewing) return;

    setCancelling(true);
    try {
      await viewingsApi.cancelViewing(viewing.id, 'tenant', 'Cancelled by tenant');
      Alert.alert('Cancelled', 'Your viewing request has been cancelled.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error cancelling viewing:', error);
      Alert.alert('Error', 'Failed to cancel viewing. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const handleCallOwner = () => {
    if (viewing?.owner?.phone) {
      Linking.openURL(`tel:${viewing.owner.phone}`);
    }
  };

  const handleViewProperty = () => {
    if (viewing?.property_id) {
      router.push({
        pathname: '/(tenant)/properties/[id]',
        params: { id: viewing.property_id },
      });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string, timeStr: string) => {
    return `${formatDate(dateStr)} at ${timeStr}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Viewing Details</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={RSA.green} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!viewing) {
    return null;
  }

  const statusColor = getStatusColor(viewing.status);
  const statusIcon = getStatusIcon(viewing.status);
  const canCancel = viewing.status === 'pending' || viewing.status === 'approved';
  const isUpcoming =
    viewing.status === 'approved' &&
    new Date(viewing.confirmed_date || viewing.requested_date) >= new Date();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Viewing Details</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Status Card */}
          <View style={[styles.statusCard, { backgroundColor: `${statusColor}15` }]}>
            <Ionicons name={statusIcon as any} size={48} color={statusColor} />
            <Text style={[styles.statusTitle, { color: statusColor }]}>
              {viewing.status.charAt(0).toUpperCase() + viewing.status.slice(1)}
            </Text>
            {isUpcoming && (
              <View style={styles.upcomingBadge}>
                <Ionicons name="alarm" size={16} color="#FFF" />
                <Text style={styles.upcomingText}>Upcoming Viewing</Text>
              </View>
            )}
          </View>

          {/* Property Card */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Property</Text>
            <TouchableOpacity style={styles.propertyCard} onPress={handleViewProperty}>
              <View style={styles.propertyHeader}>
                <Ionicons name="home" size={24} color={RSA.green} />
                <View style={styles.propertyInfo}>
                  <Text style={styles.propertyTitle}>{viewing.property?.title}</Text>
                  <Text style={styles.propertyAddress}>
                    {viewing.property?.address}, {viewing.property?.city}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#999" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Viewing Schedule */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schedule</Text>
            <View style={styles.card}>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={20} color={RSA.green} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Requested Date & Time</Text>
                  <Text style={styles.detailValue}>
                    {formatDateTime(viewing.requested_date, viewing.requested_time)}
                  </Text>
                </View>
              </View>

              {viewing.status === 'approved' && viewing.confirmed_date && (
                <View style={[styles.detailRow, styles.confirmedRow]}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Confirmed Date & Time</Text>
                    <Text style={[styles.detailValue, { color: '#4CAF50', fontWeight: '600' }]}>
                      {formatDateTime(viewing.confirmed_date, viewing.requested_time)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Your Message */}
          {viewing.tenant_notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Message</Text>
              <View style={styles.card}>
                <Text style={styles.messageText}>{viewing.tenant_notes}</Text>
              </View>
            </View>
          )}

          {/* Owner Response */}
          {viewing.owner_response && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Owner Response</Text>
              <View style={styles.card}>
                <Text style={styles.messageText}>{viewing.owner_response}</Text>
              </View>
            </View>
          )}

          {/* Alternative Times */}
          {viewing.alternative_times && viewing.alternative_times.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Suggested Alternative Times</Text>
              {(acceptedSlot || hasNewPending) ? (
                <View style={styles.slotAcceptedCard}>
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.slotAcceptedTitle}>New request sent!</Text>
                    <Text style={styles.slotAcceptedBody}>
                      {acceptedSlot
                        ? `You requested ${acceptedSlot}. The owner will be notified.`
                        : 'You already have a pending viewing request for this property.'}
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.altHint}>
                    Tap a slot to request that date & time
                  </Text>
                  {viewing.alternative_times.map((time, index) => {
                    const parsed = parseAlternativeTime(time);
                    return (
                      <TouchableOpacity
                        key={index}
                        style={styles.alternativeCard}
                        onPress={() => {
                          if (parsed.isoDate && viewing.property_id) {
                            Alert.alert(
                              'Request This Slot?',
                              `${parsed.date} at ${parsed.time}`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Request',
                                  onPress: async () => {
                                    try {
                                      await viewingsApi.requestViewing({
                                        property_id: viewing.property_id,
                                        tenant_id: viewing.tenant_id,
                                        owner_id: viewing.owner_id,
                                        requested_date: parsed.isoDate,
                                        requested_time: parsed.isoTime,
                                        tenant_notes: 'Re-request from declined viewing',
                                      });
                                      setAcceptedSlot(`${parsed.date} at ${parsed.time}`);
                                    } catch (err) {
                                      Alert.alert('Error', 'Failed to request viewing.');
                                    }
                                  },
                                },
                              ]
                            );
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.alternativeCardLeft}>
                          <Ionicons name="calendar-outline" size={22} color={RSA.green} />
                          <View>
                            <Text style={styles.alternativeCardDate}>{parsed.date}</Text>
                            {parsed.time ? (
                              <Text style={styles.alternativeCardTime}>{parsed.time}</Text>
                            ) : null}
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#999" />
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </View>
          )}

          {/* Owner Contact */}
          {viewing.owner && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Property Owner</Text>
              <View style={styles.card}>
                <View style={styles.ownerHeader}>
                  <View style={styles.ownerAvatar}>
                    <Ionicons name="person" size={24} color="#FFF" />
                  </View>
                  <View style={styles.ownerInfo}>
                    <Text style={styles.ownerName}>{viewing.owner.full_name}</Text>
                    {viewing.owner.phone && (
                      <Text style={styles.ownerContact}>{viewing.owner.phone}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.contactActions}>
                  {viewing.owner.phone && (
                    <TouchableOpacity style={styles.contactButton} onPress={handleCallOwner}>
                      <Ionicons name="call" size={18} color={RSA.green} />
                      <Text style={styles.contactButtonText}>Call</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => router.push('/(tenant)/messages' as any)}
                  >
                    <Ionicons name="chatbubble" size={18} color={RSA.green} />
                    <Text style={styles.contactButtonText}>Chat</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Timeline */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            <View style={styles.card}>
              <View style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Request Submitted</Text>
                  <Text style={styles.timelineDate}>
                    {new Date(viewing.created_at!).toLocaleString('en-ZA')}
                  </Text>
                </View>
              </View>

              {viewing.completed_at && (
                <View style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>Viewing Completed</Text>
                    <Text style={styles.timelineDate}>
                      {new Date(viewing.completed_at).toLocaleString('en-ZA')}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Actions */}
        {canCancel && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.cancelButton, cancelling && styles.buttonDisabled]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color="#F44336" />
              ) : (
                <>
                  <Ionicons name="close-circle" size={20} color="#F44336" />
                  <Text style={styles.cancelButtonText}>Cancel Viewing Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
  },
  upcomingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RSA.green,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 12,
    gap: 6,
  },
  upcomingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  propertyCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  propertyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  propertyInfo: {
    flex: 1,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  propertyAddress: {
    fontSize: 14,
    color: '#666',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  confirmedRow: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  responseDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  altHint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 10,
  },
  alternativeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  alternativeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  alternativeCardDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  alternativeCardTime: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  ownerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  ownerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: RSA.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  ownerContact: {
    fontSize: 13,
    color: '#666',
  },
  contactActions: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: RSA.green,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: RSA.green,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  timelineDate: {
    fontSize: 12,
    color: '#999',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F44336',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  slotAcceptedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  slotAcceptedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 4,
  },
  slotAcceptedBody: {
    fontSize: 13,
    color: '#388E3C',
    lineHeight: 18,
  },
});
