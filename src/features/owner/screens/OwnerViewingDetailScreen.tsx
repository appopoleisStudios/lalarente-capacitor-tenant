import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Alert,
  Linking,
  Modal,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { viewingsApi, ViewingWithRelations } from '../../properties/api/viewingsApi';

const RSA = { blue: '#002395', gold: '#FFB81C' };

type ActionType = 'approve' | 'decline' | 'complete' | null;

export default function OwnerViewingDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const viewingId = params.id as string;

  const [viewing, setViewing] = useState<ViewingWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Action modal state
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [responseNotes, setResponseNotes] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [alternativeTimes, setAlternativeTimes] = useState('');

  // Date/time modification
  const [modifyDateTime, setModifyDateTime] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadViewing();
  }, [viewingId]);

  const loadViewing = async () => {
    try {
      const data = await viewingsApi.getViewing(viewingId);
      setViewing(data);
      // Set initial date/time from request
      const date = new Date(data.requested_date);
      const [hours, minutes] = data.requested_time.split(':');
      const time = new Date();
      time.setHours(parseInt(hours), parseInt(minutes));
      setSelectedDate(date);
      setSelectedTime(time);
    } catch (error) {
      console.error('Error loading viewing:', error);
      Alert.alert('Error', 'Failed to load viewing details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePress = () => {
    setActionType('approve');
    setResponseNotes('');
    setModifyDateTime(false);
    setShowActionModal(true);
  };

  const handleDeclinePress = () => {
    setActionType('decline');
    setDeclineReason('');
    setAlternativeTimes('');
    setShowActionModal(true);
  };

  const handleCompletePress = () => {
    setActionType('complete');
    setResponseNotes('');
    setShowActionModal(true);
  };

  const handleConfirmAction = async () => {
    if (!viewing) return;

    if (actionType === 'decline' && !declineReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for declining');
      return;
    }

    setProcessing(true);

    try {
      if (actionType === 'approve') {
        await viewingsApi.approveViewing({
          viewing_id: viewing.id,
          confirmed_date: modifyDateTime
            ? selectedDate.toISOString().split('T')[0]
            : viewing.requested_date,
          owner_notes: responseNotes.trim() || undefined,
        });
        Alert.alert('Approved', 'Viewing has been approved. The tenant will be notified.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else if (actionType === 'decline') {
        const alternatives = alternativeTimes
          .split('\n')
          .map(t => t.trim())
          .filter(t => t.length > 0);

        await viewingsApi.declineViewing({
          viewing_id: viewing.id,
          owner_response: declineReason.trim(),
          alternative_times: alternatives.length > 0 ? alternatives : undefined,
        });
        Alert.alert('Declined', 'Viewing has been declined. The tenant will be notified.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else if (actionType === 'complete') {
        await viewingsApi.completeViewing(viewing.id, responseNotes.trim() || undefined);
        Alert.alert('Completed', 'Viewing has been marked as completed.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('Error processing action:', error);
      Alert.alert('Error', 'Failed to process action. Please try again.');
    } finally {
      setProcessing(false);
      setShowActionModal(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Viewing',
      'Are you sure you want to cancel this viewing?',
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

    setProcessing(true);
    try {
      await viewingsApi.cancelViewing(viewing.id, 'owner', 'Cancelled by owner');
      Alert.alert('Cancelled', 'Viewing has been cancelled.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error cancelling viewing:', error);
      Alert.alert('Error', 'Failed to cancel viewing. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCallTenant = () => {
    if (viewing?.tenant?.phone) {
      Linking.openURL(`tel:${viewing.tenant.phone}`);
    }
  };

  const handleEmailTenant = () => {
    if (viewing?.tenant?.email) {
      Linking.openURL(`mailto:${viewing.tenant.email}`);
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

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-ZA', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time: Date) => {
    return time.toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleTimeChange = (event: any, time?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (time) {
      setSelectedTime(time);
    }
  };

  const renderActionModal = () => {
    if (!actionType) return null;

    return (
      <Modal
        visible={showActionModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {actionType === 'approve' && 'Approve Viewing'}
                {actionType === 'decline' && 'Decline Viewing'}
                {actionType === 'complete' && 'Complete Viewing'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowActionModal(false)}
                disabled={processing}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {actionType === 'approve' && (
                <>
                  <View style={styles.dateTimeSection}>
                    <View style={styles.checkboxRow}>
                      <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => setModifyDateTime(!modifyDateTime)}
                      >
                        {modifyDateTime && (
                          <Ionicons name="checkmark" size={16} color={RSA.blue} />
                        )}
                      </TouchableOpacity>
                      <Text style={styles.checkboxLabel}>Modify date/time</Text>
                    </View>

                    {modifyDateTime && (
                      <View style={styles.dateTimeInputs}>
                        <TouchableOpacity
                          style={styles.dateTimeButton}
                          onPress={() => setShowDatePicker(true)}
                        >
                          <Ionicons name="calendar-outline" size={20} color={RSA.blue} />
                          <Text style={styles.dateTimeButtonText}>
                            {formatDateShort(selectedDate)}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.dateTimeButton}
                          onPress={() => setShowTimePicker(true)}
                        >
                          <Ionicons name="time-outline" size={20} color={RSA.blue} />
                          <Text style={styles.dateTimeButtonText}>
                            {formatTime(selectedTime)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Notes (Optional)</Text>
                    <TextInput
                      style={styles.textArea}
                      value={responseNotes}
                      onChangeText={setResponseNotes}
                      placeholder="Add any notes for the tenant..."
                      multiline
                      numberOfLines={3}
                      maxLength={500}
                    />
                  </View>
                </>
              )}

              {actionType === 'decline' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Reason for Declining *</Text>
                    <TextInput
                      style={styles.textArea}
                      value={declineReason}
                      onChangeText={setDeclineReason}
                      placeholder="Please provide a reason..."
                      multiline
                      numberOfLines={3}
                      maxLength={500}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Suggest Alternative Times (Optional)
                    </Text>
                    <Text style={styles.inputHint}>One per line</Text>
                    <TextInput
                      style={styles.textArea}
                      value={alternativeTimes}
                      onChangeText={setAlternativeTimes}
                      placeholder="e.g., Wednesday 3pm&#10;Thursday 10am"
                      multiline
                      numberOfLines={4}
                      maxLength={500}
                    />
                  </View>
                </>
              )}

              {actionType === 'complete' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Viewing Notes (Optional)</Text>
                  <TextInput
                    style={styles.textArea}
                    value={responseNotes}
                    onChangeText={setResponseNotes}
                    placeholder="Add notes about the viewing (e.g., tenant feedback, next steps)..."
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => setShowActionModal(false)}
                disabled={processing}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  processing && styles.buttonDisabled,
                ]}
                onPress={handleConfirmAction}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {actionType === 'approve' && 'Approve'}
                    {actionType === 'decline' && 'Decline'}
                    {actionType === 'complete' && 'Mark Complete'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Date/Time Pickers */}
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
              />
            )}
          </View>
        </View>
      </Modal>
    );
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
            <ActivityIndicator size="large" color={RSA.blue} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!viewing) {
    return null;
  }

  const isPending = viewing.status === 'pending';
  const isApproved = viewing.status === 'approved';
  const canComplete = isApproved && new Date(viewing.confirmed_date || viewing.requested_date) <= new Date();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Viewing Request</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Status Banner */}
          {isPending && (
            <View style={styles.pendingBanner}>
              <Ionicons name="alert-circle" size={24} color="#FF9800" />
              <View style={styles.pendingBannerText}>
                <Text style={styles.pendingTitle}>Action Required</Text>
                <Text style={styles.pendingMessage}>
                  Please respond to this viewing request
                </Text>
              </View>
            </View>
          )}

          {/* Property Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Property</Text>
            <View style={styles.card}>
              <View style={styles.propertyHeader}>
                <Ionicons name="home" size={24} color={RSA.blue} />
                <View style={styles.propertyInfo}>
                  <Text style={styles.propertyTitle}>{viewing.property?.title}</Text>
                  <Text style={styles.propertyAddress}>
                    {viewing.property?.address}, {viewing.property?.city}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Tenant Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prospective Tenant</Text>
            <View style={styles.card}>
              <View style={styles.tenantHeader}>
                <View style={styles.tenantAvatar}>
                  <Ionicons name="person" size={24} color="#FFF" />
                </View>
                <View style={styles.tenantInfo}>
                  <Text style={styles.tenantName}>{viewing.tenant?.full_name}</Text>
                  {viewing.tenant?.email && (
                    <Text style={styles.tenantContact}>{viewing.tenant.email}</Text>
                  )}
                  {viewing.tenant?.phone && (
                    <Text style={styles.tenantContact}>{viewing.tenant.phone}</Text>
                  )}
                </View>
              </View>

              {(viewing.tenant?.phone || viewing.tenant?.email) && (
                <View style={styles.contactActions}>
                  {viewing.tenant.phone && (
                    <TouchableOpacity style={styles.contactButton} onPress={handleCallTenant}>
                      <Ionicons name="call" size={18} color={RSA.blue} />
                      <Text style={styles.contactButtonText}>Call</Text>
                    </TouchableOpacity>
                  )}
                  {viewing.tenant.email && (
                    <TouchableOpacity style={styles.contactButton} onPress={handleEmailTenant}>
                      <Ionicons name="mail" size={18} color={RSA.blue} />
                      <Text style={styles.contactButtonText}>Email</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Viewing Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requested Schedule</Text>
            <View style={styles.card}>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={20} color={RSA.blue} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Date & Time</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(viewing.requested_date)} at {viewing.requested_time}
                  </Text>
                </View>
              </View>

              {isApproved && viewing.confirmed_date && (
                <View style={[styles.detailRow, styles.confirmedRow]}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Confirmed</Text>
                    <Text style={[styles.detailValue, { color: '#4CAF50' }]}>
                      {formatDate(viewing.confirmed_date)} at {viewing.requested_time}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Tenant Message */}
          {viewing.tenant_notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tenant Message</Text>
              <View style={styles.card}>
                <Text style={styles.messageText}>{viewing.tenant_notes}</Text>
              </View>
            </View>
          )}

          {/* Your Response */}
          {viewing.owner_response && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Response</Text>
              <View style={styles.card}>
                <Text style={styles.messageText}>{viewing.owner_response}</Text>
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
                  <Text style={styles.timelineTitle}>Request Received</Text>
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

        {/* Action Buttons */}
        {isPending && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              onPress={handleDeclinePress}
              disabled={processing}
            >
              <Ionicons name="close-circle" size={20} color="#F44336" />
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={handleApprovePress}
              disabled={processing}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.approveButtonText}>Approve</Text>
            </TouchableOpacity>
          </View>
        )}

        {canComplete && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancel}
              disabled={processing}
            >
              <Ionicons name="close-circle" size={20} color="#999" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={handleCompletePress}
              disabled={processing}
            >
              <Ionicons name="checkmark-done-circle" size={20} color="#FFF" />
              <Text style={styles.completeButtonText}>Mark Complete</Text>
            </TouchableOpacity>
          </View>
        )}

        {isApproved && !canComplete && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.singleActionButton, styles.cancelButtonFull]}
              onPress={handleCancel}
              disabled={processing}
            >
              <Ionicons name="close-circle" size={20} color="#F44336" />
              <Text style={styles.cancelButtonFullText}>Cancel Viewing</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {renderActionModal()}
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
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    gap: 12,
  },
  pendingBannerText: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 4,
  },
  pendingMessage: {
    fontSize: 14,
    color: '#F57C00',
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
  propertyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
  tenantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  tenantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: RSA.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tenantInfo: {
    flex: 1,
  },
  tenantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  tenantContact: {
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
    color: RSA.blue,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  confirmedRow: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
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
    backgroundColor: RSA.blue,
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
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  declineButton: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  declineButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F44336',
  },
  approveButton: {
    backgroundColor: RSA.blue,
  },
  approveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#999',
  },
  completeButton: {
    backgroundColor: '#4CAF50',
  },
  completeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  singleActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  cancelButtonFull: {
    flex: 1,
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  cancelButtonFullText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F44336',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  dateTimeSection: {
    marginBottom: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: RSA.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  dateTimeInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  dateTimeButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
  },
  textArea: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  cancelModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: RSA.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});
