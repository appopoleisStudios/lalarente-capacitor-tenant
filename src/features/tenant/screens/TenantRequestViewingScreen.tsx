import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { viewingsApi } from '../../properties/api/viewingsApi';
import { supabase } from '../../../lib/supabase';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';

const RSA = { green: '#007A4D', gold: '#FFB81C' };

export default function TenantRequestViewingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const propertyId = params.propertyId as string;
  const propertyTitle = params.propertyTitle as string;
  const ownerId = params.ownerId as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [message, setMessage] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingViewing, setExistingViewing] = useState<any>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    initUser();
  }, []);

  const initUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);

      // Check for existing active viewing on this property (only pending/approved block new requests)
      const { data: existing } = await supabase
        .from('viewing_requests')
        .select('id, status, requested_date, requested_time, confirmed_date, owner_response, alternative_times, updated_at')
        .eq('tenant_id', user.id)
        .eq('property_id', propertyId)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        setExistingViewing(existing[0]);
      }
    }
    setCheckingExisting(false);
  };

  const handleCancelExisting = async () => {
    if (!existingViewing) return;
    Alert.alert(
      'Cancel Viewing Request',
      'Are you sure you want to cancel this viewing request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await viewingsApi.cancelViewing(existingViewing.id, 'tenant', 'Cancelled by tenant');
              setExistingViewing(null);
            } catch (error) {
              console.error('Error cancelling viewing:', error);
              Alert.alert('Error', 'Failed to cancel viewing request.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-ZA', {
      weekday: 'short',
      year: 'numeric',
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

  const handleSubmit = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    // Validate date is in the future
    const now = new Date();
    const requestedDateTime = new Date(selectedDate);
    requestedDateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes());

    if (requestedDateTime <= now) {
      Alert.alert('Invalid Date', 'Please select a future date and time');
      return;
    }

    setSubmitting(true);

    try {
      // Race condition guard — only block if pending or approved (not declined)
      const { data: raceCheck } = await supabase
        .from('viewing_requests')
        .select('id')
        .eq('tenant_id', userId!)
        .eq('property_id', propertyId)
        .in('status', ['pending', 'approved'])
        .limit(1);

      if (raceCheck && raceCheck.length > 0) {
        Alert.alert('Already Requested', 'You already have an active viewing request for this property.');
        setSubmitting(false);
        return;
      }

      await viewingsApi.requestViewing({
        property_id: propertyId,
        tenant_id: userId,
        owner_id: ownerId,
        requested_date: selectedDate.toISOString().split('T')[0],
        requested_time: selectedTime.toTimeString().split(' ')[0].slice(0, 5),
        tenant_notes: message.trim() || undefined,
      });

      Alert.alert(
        'Request Sent',
        'Your viewing request has been sent to the property owner. You will be notified once they respond.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error requesting viewing:', error);
      Alert.alert('Error', 'Failed to submit viewing request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Request Viewing</Text>
          <View style={styles.placeholder} />
        </View>

        {checkingExisting ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={RSA.green} />
          </View>
        ) : existingViewing ? (
          /* Existing Viewing Status Card */
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.propertyCard}>
              <Ionicons name="home" size={24} color={RSA.green} />
              <View style={styles.propertyInfo}>
                <Text style={styles.propertyTitle} numberOfLines={2}>
                  {propertyTitle}
                </Text>
                <Text style={styles.propertyHint}>Property viewing request</Text>
              </View>
            </View>

            <View style={[
              styles.existingCard,
              { borderLeftColor: existingViewing.status === 'approved' ? '#4CAF50' : RSA.gold },
            ]}>
              <View style={styles.existingHeader}>
                <View style={[
                  styles.existingBadge,
                  { backgroundColor: existingViewing.status === 'approved' ? '#E8F5E9' : '#FFF8E1' },
                ]}>
                  <Ionicons
                    name={existingViewing.status === 'approved' ? 'checkmark-circle' : 'time'}
                    size={20}
                    color={existingViewing.status === 'approved' ? '#4CAF50' : '#F9A825'}
                  />
                  <Text style={[
                    styles.existingBadgeText,
                    { color: existingViewing.status === 'approved' ? '#2E7D32' : '#F57F17' },
                  ]}>
                    {existingViewing.status === 'approved' ? 'Viewing Confirmed' : 'Viewing Request Pending'}
                  </Text>
                </View>
              </View>

              <Text style={styles.existingMessage}>
                {existingViewing.status === 'approved'
                  ? 'Your viewing has been approved by the property owner.'
                  : 'You already have a pending viewing request for this property.'}
              </Text>

              <View style={styles.existingDateRow}>
                <Ionicons name="calendar-outline" size={18} color="#666" />
                <Text style={styles.existingDateText}>
                  {new Date(existingViewing.requested_date).toLocaleDateString('en-ZA', {
                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                  })} at {existingViewing.requested_time?.slice(0, 5) || '—'}
                </Text>
              </View>

              <Text style={styles.existingStatusLabel}>
                {existingViewing.status === 'approved'
                  ? 'Confirmed — see you there!'
                  : 'Awaiting owner response'}
              </Text>

              {existingViewing.owner_response && (
                <View style={styles.ownerResponseBox}>
                  <Text style={styles.ownerResponseLabel}>Owner's response:</Text>
                  <Text style={styles.ownerResponseText}>{existingViewing.owner_response}</Text>
                </View>
              )}

              <View style={styles.existingActions}>
                <TouchableOpacity
                  style={styles.viewDetailsButton}
                  onPress={() => router.push(`/(tenant)/viewings/${existingViewing.id}` as any)}
                >
                  <Ionicons name="eye-outline" size={18} color={RSA.green} />
                  <Text style={styles.viewDetailsText}>View Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelExisting}
                  disabled={cancelling}
                >
                  {cancelling ? (
                    <ActivityIndicator size="small" color="#D32F2F" />
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={18} color="#D32F2F" />
                      <Text style={styles.cancelButtonText}>Cancel Request</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        ) : (
          /* Normal Request Form */
          <>
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Property Info */}
              <View style={styles.propertyCard}>
                <Ionicons name="home" size={24} color={RSA.green} />
                <View style={styles.propertyInfo}>
                  <Text style={styles.propertyTitle} numberOfLines={2}>
                    {propertyTitle}
                  </Text>
                  <Text style={styles.propertyHint}>Property viewing request</Text>
                </View>
              </View>

              {/* Date Selection */}
              <View style={styles.section}>
                <Text style={styles.label}>Preferred Date *</Text>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color={RSA.green} />
                  <Text style={styles.dateTimeText}>{formatDate(selectedDate)}</Text>
                  <Ionicons name="chevron-down" size={20} color="#999" />
                </TouchableOpacity>
              </View>

              {/* Time Selection */}
              <View style={styles.section}>
                <Text style={styles.label}>Preferred Time *</Text>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={20} color={RSA.green} />
                  <Text style={styles.dateTimeText}>{formatTime(selectedTime)}</Text>
                  <Ionicons name="chevron-down" size={20} color="#999" />
                </TouchableOpacity>
              </View>

              {/* Message */}
              <View style={styles.section}>
                <Text style={styles.label}>Message (Optional)</Text>
                <TextInput
                  style={styles.textArea}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Add any questions or special requests for the viewing..."
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{message.length}/500</Text>
              </View>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={RSA.green} />
                <Text style={styles.infoText}>
                  The property owner will receive your request and can either approve it or suggest
                  alternative times. You'll be notified of their response.
                </Text>
              </View>

              {/* Tips */}
              <View style={styles.tipsSection}>
                <Text style={styles.tipsTitle}>Viewing Tips:</Text>
                <View style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={16} color={RSA.green} />
                  <Text style={styles.tipText}>Arrive on time for the viewing</Text>
                </View>
                <View style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={16} color={RSA.green} />
                  <Text style={styles.tipText}>Bring valid ID for verification</Text>
                </View>
                <View style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={16} color={RSA.green} />
                  <Text style={styles.tipText}>Prepare questions about the property</Text>
                </View>
                <View style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={16} color={RSA.green} />
                  <Text style={styles.tipText}>Check neighborhood and amenities</Text>
                </View>
              </View>
            </ScrollView>

            {/* Submit Button */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#FFF" />
                    <Text style={styles.submitButtonText}>Send Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}

        {/* Time Picker */}
        {showTimePicker && (
          <DateTimePicker
            value={selectedTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
          />
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
  content: {
    flex: 1,
    padding: 16,
  },
  propertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  propertyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  propertyHint: {
    fontSize: 13,
    color: '#999',
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 12,
  },
  dateTimeText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  textArea: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#2E7D32',
    lineHeight: 18,
  },
  tipsSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RSA.green,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  existingCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    marginBottom: 20,
  },
  existingHeader: {
    marginBottom: 12,
  },
  existingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  existingBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  existingMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  existingDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  existingDateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  existingStatusLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 16,
  },
  ownerResponseBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  ownerResponseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 4,
  },
  ownerResponseText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  existingActions: {
    flexDirection: 'row',
    gap: 12,
  },
  viewDetailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: RSA.green,
    gap: 6,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: RSA.green,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    backgroundColor: '#FFF5F5',
    gap: 6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D32F2F',
  },
  alternativeTimesBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  alternativeTimesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 4,
  },
  alternativeTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alternativeTimeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});
