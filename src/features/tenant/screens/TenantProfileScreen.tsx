import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';

const RSA = { green: '#007A4D', blue: '#002395' };

export default function TenantProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Personal Information
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Employment Information
  const [employer, setEmployer] = useState('');
  const [position, setPosition] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [employmentStartDate, setEmploymentStartDate] = useState('');
  const [employerContact, setEmployerContact] = useState('');

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
        setEmail(profileData.email || user.email || '');
        setPhone(profileData.phone || '');
        
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
        
        setEmploymentStartDate(profileData.employment_start_date || '');
        setEmployerContact(profileData.employer_contact || '');
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
        phone: phone,
        fica_documents: {
          ...currentFica,
          id_number: idNumber,
          date_of_birth: dateOfBirth,
          employer: employer,
          employment_status: position,
          monthly_income: monthlyIncome ? parseFloat(monthlyIncome) : null,
        },
      };

      // Try to update new columns (will work after migration)
      try {
        updateData.id_number = idNumber;
        updateData.date_of_birth = dateOfBirth;
        updateData.employer = employer;
        updateData.position = position;
        updateData.monthly_income = monthlyIncome ? parseFloat(monthlyIncome) : null;
        updateData.employment_start_date = employmentStartDate || null;
        updateData.employer_contact = employerContact || null;
      } catch (e) {
        // Columns don't exist yet
      }

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

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={phone}
                onChangeText={setPhone}
                editable={editing}
                placeholder="+27 XX XXX XXXX"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
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
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                editable={editing}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
              />
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
              <Text style={styles.label}>Employment Start Date</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={employmentStartDate}
                onChangeText={setEmploymentStartDate}
                editable={editing}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
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

          {/* Info Note */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color={RSA.blue} />
            <Text style={styles.infoText}>
              This information will be used to pre-fill your rental applications and help property owners review your profile.
            </Text>
          </View>

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
});
