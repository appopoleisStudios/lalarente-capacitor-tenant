import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../lib/supabase';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';

const RSA = { green: '#007A4D', blue: '#002395' };

export default function TenantProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);

  // Personal Information
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+27');
  const [localPhone, setLocalPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Employment Information
  const [employer, setEmployer] = useState('');
  const [position, setPosition] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [employerContact, setEmployerContact] = useState('');

  // Proof of Address
  const [proofOfAddressUrl, setProofOfAddressUrl] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        const profileData = profile as any;

        // Personal Information
        setFullName(profileData.full_name || '');
        // Always prefer auth email — it's authoritative
        setEmail(user.email || profileData.email || '');
        const rawPhone = profileData.phone || '';
        const knownCodes = ['+27', '+263', '+267', '+44', '+1', '+91'];
        const matched = knownCodes.find(c => rawPhone.startsWith(c));
        setCountryCode(matched || '+27');
        setLocalPhone(matched ? rawPhone.slice(matched.length).trim() : rawPhone);
        
        // ID number: Check new column first, then JSONB field
        const idFromColumn = profileData.id_number;
        const idFromJson = profileData.fica_documents?.id_number;
        setIdNumber(idFromColumn || idFromJson || '');
        
        // Date of birth: Check new column first, then JSONB field
        const dobFromColumn = profileData.date_of_birth;
        const dobFromJson = profileData.fica_documents?.date_of_birth;
        setDateOfBirth(dobFromColumn || dobFromJson || '');
        
        // Employment Information
        const employerFromColumn = profileData.employer;
        const employerFromJson = profileData.fica_documents?.employer;
        setEmployer(employerFromColumn || employerFromJson || '');
        
        const positionFromColumn = profileData.position;
        const positionFromJson = profileData.fica_documents?.employment_status;
        setPosition(positionFromColumn || positionFromJson || '');
        
        const incomeFromColumn = profileData.monthly_income;
        const incomeFromJson = profileData.fica_documents?.monthly_income;
        setMonthlyIncome((incomeFromColumn || incomeFromJson)?.toString() || '');
        
        setEmployerContact(profileData.employer_contact || '');

        // Proof of Address
        setProofOfAddressUrl(profileData.proof_of_address_url || '');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current profile to preserve existing JSONB data
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('fica_documents')
        .eq('id', user.id)
        .single();

      const currentFica = (currentProfile as any)?.fica_documents || {};

      // Update both JSONB and new columns
      const updateData: any = {
        full_name: fullName,
        email: email,
        phone: localPhone ? `${countryCode} ${localPhone}` : null,
        fica_documents: {
          ...currentFica,
          id_number: idNumber,
          date_of_birth: dateOfBirth,
          employer: employer,
          employment_status: position,
          monthly_income: monthlyIncome ? parseFloat(monthlyIncome) : null,
        },
      };

      // Update profile columns
      updateData.id_number = idNumber;
      updateData.date_of_birth = dateOfBirth || null;
      updateData.employer = employer || null;
      updateData.position = position || null;
      updateData.monthly_income = monthlyIncome ? parseFloat(monthlyIncome) : null;
      updateData.employer_contact = employerContact || null;
      updateData.proof_of_address_url = proofOfAddressUrl || null;

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      Alert.alert('Success', 'Profile updated successfully');
      setEditing(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadProofOfAddress = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const ext = asset.uri.split('.').pop() || 'jpg';
      const path = `proof-of-address/${user.id}/poa_${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, blob, { contentType: `image/${ext}`, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
      setProofOfAddressUrl(urlData.publicUrl);

      // Auto-save the URL
      await supabase
        .from('profiles')
        .update({ proof_of_address_url: urlData.publicUrl })
        .eq('id', user.id);

      Alert.alert('Uploaded', 'Proof of address uploaded successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to upload document');
    }
  };

  // Profile completion check
  const missingFields: string[] = [];
  if (!idNumber) missingFields.push('SA ID Number');
  if (!email) missingFields.push('Email Address');
  if (!localPhone) missingFields.push('Phone Number');
  if (!proofOfAddressUrl) missingFields.push('Proof of Address');
  const isProfileComplete = missingFields.length === 0;

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={RSA.green} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <TouchableOpacity
            onPress={() => (editing ? handleSave() : setEditing(true))}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={RSA.green} />
            ) : (
              <Text style={styles.editButton}>{editing ? 'Save' : 'Edit'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Profile Completion Banner */}
          {!editing && !loading && (
            isProfileComplete ? (
              <View style={styles.completeBanner}>
                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                <Text style={styles.completeBannerText}>Profile complete</Text>
              </View>
            ) : (
              <View style={styles.incompleteBanner}>
                <Ionicons name="alert-circle" size={20} color="#DC2626" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.incompleteBannerTitle}>
                    Complete your profile to apply for properties
                  </Text>
                  <Text style={styles.incompleteBannerList}>
                    Missing: {missingFields.join(', ')}
                  </Text>
                </View>
              </View>
            )
          )}

          {/* Personal Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={fullName}
                onChangeText={setFullName}
                editable={editing}
                placeholder="Enter your full name"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={email}
                onChangeText={setEmail}
                editable={editing}
                placeholder="your.email@example.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.phoneRow}>
                <TouchableOpacity
                  style={[styles.codeChip, !editing && styles.inputDisabled]}
                  disabled={!editing}
                  onPress={() => {
                    if (!editing) return;
                    Alert.alert('Country Code', 'Select your country calling code', [
                      { text: '+27  South Africa', onPress: () => setCountryCode('+27') },
                      { text: '+263  Zimbabwe', onPress: () => setCountryCode('+263') },
                      { text: '+267  Botswana', onPress: () => setCountryCode('+267') },
                      { text: '+44  United Kingdom', onPress: () => setCountryCode('+44') },
                      { text: '+1  USA / Canada', onPress: () => setCountryCode('+1') },
                      { text: '+91  India', onPress: () => setCountryCode('+91') },
                      { text: 'Cancel', style: 'cancel' },
                    ]);
                  }}
                >
                  <Text style={styles.codeText}>{countryCode}</Text>
                  {editing && <Ionicons name="chevron-down-outline" size={12} color="#666" />}
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, styles.phoneInput, !editing && styles.inputDisabled]}
                  value={localPhone}
                  onChangeText={setLocalPhone}
                  editable={editing}
                  placeholder="82 123 4567"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>ID Number</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={idNumber}
                onChangeText={setIdNumber}
                editable={editing}
                placeholder="Enter your ID number"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date of Birth</Text>
              <TouchableOpacity
                style={[styles.input, !editing && styles.inputDisabled]}
                onPress={() => editing && setShowDobPicker(true)}
                activeOpacity={editing ? 0.7 : 1}
              >
                <Text style={{ color: dateOfBirth ? '#333' : '#999', fontSize: 16 }}>
                  {dateOfBirth || 'Select date'}
                </Text>
              </TouchableOpacity>
              {showDobPicker && (
                <DateTimePicker
                  value={dateOfBirth ? new Date(dateOfBirth) : new Date(2000, 0, 1)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDobPicker(false);
                    if (date) setDateOfBirth(date.toISOString().split('T')[0]);
                  }}
                />
              )}
            </View>
          </View>

          {/* Employment Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Employment Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Employer</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={employer}
                onChangeText={setEmployer}
                editable={editing}
                placeholder="Company name"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Position</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={position}
                onChangeText={setPosition}
                editable={editing}
                placeholder="Your job title"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Monthly Income (Gross)</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={monthlyIncome}
                onChangeText={setMonthlyIncome}
                editable={editing}
                placeholder="0"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Employer Contact</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={employerContact}
                onChangeText={setEmployerContact}
                editable={editing}
                placeholder="HR phone or email"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* Proof of Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Proof of Address</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Proof of Address Document</Text>
              {proofOfAddressUrl ? (
                <View style={styles.uploadedRow}>
                  <Ionicons name="document-attach" size={20} color={RSA.green} />
                  <Text style={styles.uploadedText} numberOfLines={1}>
                    Document uploaded
                  </Text>
                  {editing && (
                    <TouchableOpacity onPress={handleUploadProofOfAddress}>
                      <Text style={styles.replaceText}>Replace</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleUploadProofOfAddress}
                >
                  <Ionicons name="cloud-upload-outline" size={22} color={RSA.green} />
                  <Text style={styles.uploadButtonText}>
                    Upload utility bill or bank statement
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={styles.uploadHint}>
                Recent utility bill, bank statement, or municipal account (not older than 3 months)
              </Text>
            </View>
          </View>

          {/* Info Note */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color={RSA.blue} />
            <Text style={styles.infoText}>
              This information will be used to pre-fill your rental applications and help property owners review your profile.
            </Text>
          </View>

          {/* Privacy & Data Rights */}
          <TouchableOpacity
            style={styles.privacyButton}
            onPress={() => router.push('/(tenant)/privacy')}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={RSA.blue} />
            <View style={styles.privacyContent}>
              <Text style={styles.privacyTitle}>Privacy & Data Rights</Text>
              <Text style={styles.privacySubtitle}>Manage your data, consent & POPIA rights</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Sign Out Button */}
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color="#F44336" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  editButton: {
    fontSize: 16,
    fontWeight: '600',
    color: RSA.green,
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
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  inputDisabled: {
    backgroundColor: '#F5F5F5',
    color: '#666',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minWidth: 72,
    justifyContent: 'center',
  },
  codeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  phoneInput: {
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  privacyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 12,
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E40AF',
  },
  privacySubtitle: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
  },
  completeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    margin: 16,
    marginBottom: 0,
    gap: 8,
  },
  completeBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16A34A',
  },
  incompleteBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    margin: 16,
    marginBottom: 0,
    gap: 10,
  },
  incompleteBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 4,
  },
  incompleteBannerList: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  uploadedText: {
    flex: 1,
    fontSize: 14,
    color: '#16A34A',
    fontWeight: '500',
  },
  replaceText: {
    fontSize: 14,
    fontWeight: '600',
    color: RSA.green,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    borderStyle: 'dashed',
    padding: 16,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: RSA.green,
  },
  uploadHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
    lineHeight: 16,
  },
});
