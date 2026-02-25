/**
 * Owner Send PO Screen
 * Owner sends Purchase Order to vendor with work schedule and instructions
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/src/lib/supabase';
import { sendPOToVendor } from '@/src/features/maintenance/api/purchase-orders/poActions.api';

export default function OwnerSendPOScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);
  const params = useLocalSearchParams();

  // Parse params
  const poId = params.poId as string;
  const vendorName = params.vendorName as string;
  const totalAmount = params.totalAmount as string;
  const propertyAddress = params.propertyAddress as string;
  const requestId = params.requestId as string;

  // Form state
  const [startDate, setStartDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [workInstructions, setWorkInstructions] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setStartTime(selectedTime);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSendPO = async () => {
    if (!userId) {
      Alert.alert('Error', 'You must be logged in to send a PO');
      return;
    }

    // Validation
    if (!workInstructions.trim()) {
      Alert.alert('Required', 'Please provide work instructions for the vendor');
      return;
    }

    if (startDate < new Date()) {
      Alert.alert('Invalid Date', 'Work start date cannot be in the past');
      return;
    }

    try {
      setIsSubmitting(true);

      // Format date and time for database (ISO format for date, HH:MM for time)
      const scheduledDate = startDate.toISOString().split('T')[0];
      const scheduledTime = startTime.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

      await sendPOToVendor(
        poId,
        scheduledDate,
        scheduledTime,
        workInstructions.trim(),
        userId!
      );

      Alert.alert('Success', 'Purchase order sent to vendor', [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back to maintenance detail
            router.back();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error sending PO:', error);
      Alert.alert('Error', error.message || 'Failed to send purchase order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Send Purchase Order</Text>
        <Text style={styles.subtitle}>Schedule work and send PO to vendor</Text>
      </View>

      {/* PO Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PO Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Vendor:</Text>
          <Text style={styles.summaryValue}>{vendorName}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Property:</Text>
          <Text style={styles.summaryValue}>{propertyAddress}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Amount:</Text>
          <Text style={styles.summaryValueBold}>R {totalAmount}</Text>
        </View>
      </View>

      {/* Work Schedule */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Work Schedule</Text>

        {/* Start Date */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Start Date *</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>{formatDate(startDate)}</Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}

        {/* Start Time */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Start Time *</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.dateButtonText}>{formatTime(startTime)}</Text>
          </TouchableOpacity>
        </View>

        {showTimePicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
          />
        )}
      </View>

      {/* Work Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Work Instructions *</Text>
        <Text style={styles.helperText}>
          Provide detailed instructions for the vendor. Include any special requirements,
          access instructions, or specific work details.
        </Text>
        <TextInput
          style={styles.textArea}
          value={workInstructions}
          onChangeText={setWorkInstructions}
          placeholder="Enter work instructions for the vendor..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </View>

      {/* Send Button */}
      <TouchableOpacity
        style={[styles.sendButton, isSubmitting && styles.sendButtonDisabled]}
        onPress={handleSendPO}
        disabled={isSubmitting}
      >
        <Text style={styles.sendButtonText}>
          {isSubmitting ? 'Sending...' : 'Send Purchase Order'}
        </Text>
      </TouchableOpacity>

      {/* Cancel Button */}
      <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1A1A1A',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  summaryValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  dateButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1A1A1A',
    minHeight: 120,
  },
  sendButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});
