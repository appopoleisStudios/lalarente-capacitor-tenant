import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';

const RSA = { blue: '#002395', gold: '#FFB81C' }; // Owner colors

interface Application {
  id: string;
  property_id: string;
  tenant_id: string;
  monthly_income: number;
  property?: {
    title: string;
    rent_amount: number;
    deposit_amount: number | null;
  };
  tenant?: {
    full_name: string;
    email: string | null;
    phone: string | null;
  };
}

export default function OwnerLeaseCreateScreen() {
  const router = useRouter();
  const { applicationId } = useLocalSearchParams();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Lease form fields
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaseType, setLeaseType] = useState<'fixed_term' | 'month_to_month'>('fixed_term');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [paymentDueDay, setPaymentDueDay] = useState('1');
  const [lateFeeAmount, setLateFeeAmount] = useState('');
  const [lateFeeGraceDays, setLateFeeGraceDays] = useState('3');
  const [rentEscalationType, setRentEscalationType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [rentEscalationValue, setRentEscalationValue] = useState('');
  const [rentEscalationFrequency, setRentEscalationFrequency] = useState('12');

  useEffect(() => {
    if (applicationId) {
      loadApplication();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const loadApplication = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const appId = Array.isArray(applicationId) ? applicationId[0] : applicationId;
      if (!appId) return;

      const { data, error } = await supabase
        .from('rental_applications')
        .select(`
          *,
          property:properties!property_id(title, rent_amount, deposit_amount),
          tenant:profiles!tenant_id(full_name, email, phone)
        `)
        .eq('id', appId)
        .eq('owner_id', user.id)
        .eq('status', 'approved')
        .single();

      if (error) throw error;

      setApplication(data as Application);
      
      // Pre-populate form with property data
      if (data.property) {
        setMonthlyRent(data.property.rent_amount.toString());
        setDepositAmount(data.property.deposit_amount?.toString() || '');
      }

      // Set default dates (start: next month, end: 12 months later)
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const oneYearLater = new Date(nextMonth.getFullYear() + 1, nextMonth.getMonth(), 0);
      
      setStartDate(nextMonth.toISOString().split('T')[0]);
      setEndDate(oneYearLater.toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error loading application:', error);
      Alert.alert('Error', 'Failed to load application');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!startDate || !endDate) {
      Alert.alert('Validation Error', 'Please select start and end dates');
      return false;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      Alert.alert('Validation Error', 'End date must be after start date');
      return false;
    }

    if (!monthlyRent || parseFloat(monthlyRent) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid monthly rent');
      return false;
    }

    if (!paymentDueDay || parseInt(paymentDueDay) < 1 || parseInt(paymentDueDay) > 31) {
      Alert.alert('Validation Error', 'Payment due day must be between 1 and 31');
      return false;
    }

    return true;
  };

  const handleCreateLease = async () => {
    if (!validateForm() || !application) return;

    Alert.alert(
      'Create Lease',
      'This will create a lease agreement and send it to the tenant for signing. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async () => {
            setSubmitting(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not authenticated');

              const { data: lease, error: leaseError } = await supabase
                .from('leases')
                .insert({
                  application_id: application.id,
                  property_id: application.property_id,
                  owner_id: user.id,
                  tenant_id: application.tenant_id,
                  start_date: startDate,
                  end_date: endDate,
                  lease_type: leaseType,
                  monthly_rent: parseFloat(monthlyRent),
                  deposit_amount: depositAmount ? parseFloat(depositAmount) : null,
                  payment_due_day: parseInt(paymentDueDay),
                  late_fee_amount: lateFeeAmount ? parseFloat(lateFeeAmount) : null,
                  late_fee_grace_days: lateFeeGraceDays ? parseInt(lateFeeGraceDays) : null,
                  rent_escalation_type: rentEscalationValue ? rentEscalationType : null,
                  rent_escalation_value: rentEscalationValue ? parseFloat(rentEscalationValue) : null,
                  rent_escalation_frequency_months: rentEscalationValue ? parseInt(rentEscalationFrequency) : null,
                  status: 'pending_signatures',
                })
                .select()
                .single();

              if (leaseError) throw leaseError;

              // Update application status
              await supabase
                .from('rental_applications')
                .update({ status: 'lease_created' })
                .eq('id', application.id);

              Alert.alert(
                'Success',
                'Lease created successfully! The tenant will be notified to sign the agreement.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.push(`/(owner)/leases/${lease.id}`),
                  },
                ]
              );
            } catch (error) {
              console.error('Error creating lease:', error);
              Alert.alert('Error', 'Failed to create lease. Please try again.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={RSA.blue} />
        </View>
      </SafeAreaView>
    );
  }

  if (!application) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#F44336" />
          <Text style={styles.errorText}>Application not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Lease</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scrollView}>
          {/* Application Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Application Details</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tenant</Text>
                <Text style={styles.infoValue}>{application.tenant?.full_name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Property</Text>
                <Text style={styles.infoValue}>{application.property?.title}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Monthly Income</Text>
                <Text style={styles.infoValue}>R {application.monthly_income.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Lease Period */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lease Period</Text>
            <View style={styles.card}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Lease Type</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setLeaseType('fixed_term')}
                  >
                    <Ionicons
                      name={leaseType === 'fixed_term' ? 'radio-button-on' : 'radio-button-off'}
                      size={24}
                      color={RSA.blue}
                    />
                    <Text style={styles.radioLabel}>Fixed Term</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setLeaseType('month_to_month')}
                  >
                    <Ionicons
                      name={leaseType === 'month_to_month' ? 'radio-button-on' : 'radio-button-off'}
                      size={24}
                      color={RSA.blue}
                    />
                    <Text style={styles.radioLabel}>Month-to-Month</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Start Date *</Text>
                <TextInput
                  style={styles.input}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>End Date *</Text>
                <TextInput
                  style={styles.input}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#999"
                />
              </View>
            </View>
          </View>

          {/* Financial Terms */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Financial Terms</Text>
            <View style={styles.card}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Monthly Rent (R) *</Text>
                <TextInput
                  style={styles.input}
                  value={monthlyRent}
                  onChangeText={setMonthlyRent}
                  placeholder="15000"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Deposit Amount (R)</Text>
                <TextInput
                  style={styles.input}
                  value={depositAmount}
                  onChangeText={setDepositAmount}
                  placeholder="15000"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Payment Due Day (1-31) *</Text>
                <TextInput
                  style={styles.input}
                  value={paymentDueDay}
                  onChangeText={setPaymentDueDay}
                  placeholder="1"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Late Fee Amount (R)</Text>
                <TextInput
                  style={styles.input}
                  value={lateFeeAmount}
                  onChangeText={setLateFeeAmount}
                  placeholder="500"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Late Fee Grace Days</Text>
                <TextInput
                  style={styles.input}
                  value={lateFeeGraceDays}
                  onChangeText={setLateFeeGraceDays}
                  placeholder="3"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>
            </View>
          </View>

          {/* Rent Escalation */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rent Escalation (Optional)</Text>
            <View style={styles.card}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Escalation Type</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setRentEscalationType('percentage')}
                  >
                    <Ionicons
                      name={rentEscalationType === 'percentage' ? 'radio-button-on' : 'radio-button-off'}
                      size={24}
                      color={RSA.blue}
                    />
                    <Text style={styles.radioLabel}>Percentage</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setRentEscalationType('fixed_amount')}
                  >
                    <Ionicons
                      name={rentEscalationType === 'fixed_amount' ? 'radio-button-on' : 'radio-button-off'}
                      size={24}
                      color={RSA.blue}
                    />
                    <Text style={styles.radioLabel}>Fixed Amount</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Escalation Value ({rentEscalationType === 'percentage' ? '%' : 'R'})
                </Text>
                <TextInput
                  style={styles.input}
                  value={rentEscalationValue}
                  onChangeText={setRentEscalationValue}
                  placeholder={rentEscalationType === 'percentage' ? '7' : '1000'}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Escalation Frequency (months)</Text>
                <TextInput
                  style={styles.input}
                  value={rentEscalationFrequency}
                  onChangeText={setRentEscalationFrequency}
                  placeholder="12"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>
            </View>
          </View>

          {/* Create Button */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.createButton, submitting && styles.createButtonDisabled]}
              onPress={handleCreateLease}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="document-text" size={20} color="#FFF" />
                  <Text style={styles.createButtonText}>Create Lease Agreement</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FFF',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RSA.blue,
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: RSA.blue,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
