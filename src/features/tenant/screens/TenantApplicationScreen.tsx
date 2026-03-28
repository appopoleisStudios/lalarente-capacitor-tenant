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
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../../lib/supabase';
import { applicationsApi } from '../../properties/api/applicationsApi';
import { propertiesApi } from '../../properties/api/propertiesApi';
import { uploadFile } from '../../../lib/storage';
import type { PropertyWithRelations } from '../../properties/api/propertiesApi';

const RSA = { green: '#007A4D', blue: '#002395' };

type DocFile = { uri: string; name: string; type: string };

export default function TenantApplicationScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();

  const [property, setProperty] = useState<PropertyWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

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

  // Documents
  const [idDocFile, setIdDocFile] = useState<DocFile | null>(null);
  const [incomeDocFiles, setIncomeDocFiles] = useState<DocFile[]>([]);
  const [referenceDocFiles, setReferenceDocFiles] = useState<DocFile[]>([]);

  // Affordability
  const [affordabilityRatio, setAffordabilityRatio] = useState<number | null>(null);
  const [isAffordable, setIsAffordable] = useState<boolean | null>(null);

  useEffect(() => {
    loadPropertyAndProfile();
  }, [propertyId]);

  useEffect(() => {
    calculateAffordability();
  }, [monthlyIncome, property]);

  const loadPropertyAndProfile = async () => {
    try {
      const propertyData = await propertiesApi.getProperty(propertyId);
      setProperty(propertyData);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          const profileData = profile as any;

          setFullName(profileData.full_name || '');
          setEmail(profileData.email || user.email || '');
          setPhone(profileData.phone || '');

          const idFromColumn = profileData.id_number;
          const idFromJson = profileData.fica_documents?.id_number;
          setIdNumber(idFromColumn || idFromJson || '');

          const dobFromColumn = profileData.date_of_birth;
          const dobFromJson = profileData.fica_documents?.date_of_birth;
          setDateOfBirth(dobFromColumn || dobFromJson || '');

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
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load property details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const calculateAffordability = () => {
    if (!monthlyIncome || !property?.rent_amount) {
      setAffordabilityRatio(null);
      setIsAffordable(null);
      return;
    }

    const income = parseFloat(monthlyIncome);
    const rent = property.rent_amount;
    const ratio = rent / income;

    setAffordabilityRatio(ratio);
    setIsAffordable(ratio <= 0.3);
  };

  // ── Document Pickers ──

  const pickFromCamera = async (): Promise<DocFile | null> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Please allow camera access to take photos');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: asset.fileName || `photo_${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    };
  };

  const pickFromFiles = async (): Promise<DocFile | null> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || 'application/octet-stream',
    };
  };

  const showPickerSheet = (onPick: (file: DocFile) => void) => {
    Alert.alert('Upload Document', 'Choose source', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const file = await pickFromCamera();
          if (file) onPick(file);
        },
      },
      {
        text: 'Choose File',
        onPress: async () => {
          const file = await pickFromFiles();
          if (file) onPick(file);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickIdDoc = () => showPickerSheet((file) => setIdDocFile(file));

  const pickIncomeDoc = () => {
    if (incomeDocFiles.length >= 3) {
      Alert.alert('Limit Reached', 'Maximum 3 proof of income files allowed');
      return;
    }
    showPickerSheet((file) => setIncomeDocFiles((prev) => [...prev, file]));
  };

  const pickReferenceDoc = () => {
    if (referenceDocFiles.length >= 3) {
      Alert.alert('Limit Reached', 'Maximum 3 reference files allowed');
      return;
    }
    showPickerSheet((file) => setReferenceDocFiles((prev) => [...prev, file]));
  };

  // ── Validation ──

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!fullName.trim()) {
          Alert.alert('Required', 'Please enter your full name');
          return false;
        }
        if (fullName.trim().length < 3) {
          Alert.alert('Invalid', 'Full name must be at least 3 characters');
          return false;
        }

        if (!email.trim()) {
          Alert.alert('Required', 'Please enter your email');
          return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          Alert.alert('Invalid', 'Please enter a valid email address');
          return false;
        }

        if (!phone.trim()) {
          Alert.alert('Required', 'Please enter your phone number');
          return false;
        }
        const phoneRegex = /^[\d\s\+\-\(\)]+$/;
        if (!phoneRegex.test(phone.trim()) || phone.trim().length < 10) {
          Alert.alert('Invalid', 'Please enter a valid phone number (at least 10 digits)');
          return false;
        }

        if (!idNumber.trim()) {
          Alert.alert('Required', 'Please enter your ID number');
          return false;
        }

        if (!dateOfBirth.trim()) {
          Alert.alert('Required', 'Please enter your date of birth');
          return false;
        }
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateOfBirth.trim())) {
          Alert.alert('Invalid', 'Date of birth must be in YYYY-MM-DD format (e.g., 1990-05-15)');
          return false;
        }
        const dob = new Date(dateOfBirth);
        if (isNaN(dob.getTime())) {
          Alert.alert('Invalid', 'Please enter a valid date');
          return false;
        }
        const [_y, dobMonth, dobDay] = dateOfBirth.split('-').map(Number);
        if (dobMonth < 1 || dobMonth > 12) {
          Alert.alert('Invalid', 'Month must be between 01 and 12');
          return false;
        }
        if (dobDay < 1 || dobDay > 31) {
          Alert.alert('Invalid', 'Day must be between 01 and 31');
          return false;
        }
        const today = new Date();
        if (dob > today) {
          Alert.alert('Invalid', 'Date of birth cannot be in the future');
          return false;
        }
        const age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        const dayDiff = today.getDate() - dob.getDate();
        return true;

      case 2:
        if (monthlyIncome.trim()) {
          const income = parseFloat(monthlyIncome);
          if (isNaN(income) || income < 0) {
            Alert.alert('Invalid', 'Please enter a valid monthly income');
            return false;
          }
        }

        if (employmentStartDate.trim()) {
          const empDateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!empDateRegex.test(employmentStartDate.trim())) {
            Alert.alert('Invalid', 'Employment start date must be in YYYY-MM-DD format (e.g., 2020-01-15)');
            return false;
          }
          const empDate = new Date(employmentStartDate);
          if (isNaN(empDate.getTime())) {
            Alert.alert('Invalid', 'Please enter a valid employment start date');
            return false;
          }
          const [_ey, empM, empD] = employmentStartDate.split('-').map(Number);
          if (empM < 1 || empM > 12 || empD < 1 || empD > 31) {
            Alert.alert('Invalid', 'Please enter a valid date (MM: 01-12, DD: 01-31)');
            return false;
          }
          const todayEmp = new Date();
          if (empDate > todayEmp) {
            Alert.alert('Invalid', 'Employment start date cannot be in the future');
            return false;
          }
        }

        return true;

      case 3:
        if (!idDocFile) {
          Alert.alert('Required', 'Please upload your SA ID or passport');
          return false;
        }
        if (incomeDocFiles.length === 0) {
          Alert.alert('Required', 'Please upload at least one proof of income');
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    if (affordabilityRatio && affordabilityRatio > 0.3) {
      Alert.alert(
        'Affordability Warning',
        `Your rent-to-income ratio is ${(affordabilityRatio * 100).toFixed(1)}%, which exceeds the recommended 30% threshold. Do you want to continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: submitApplication },
        ]
      );
    } else {
      submitApplication();
    }
  };

  const updateProfile = async (userId: string) => {
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('fica_documents')
      .eq('id', userId)
      .single();

    const currentFica = (currentProfile as any)?.fica_documents || {};

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
        monthly_income: parseFloat(monthlyIncome),
      },
    };

    try {
      updateData.id_number = idNumber;
      updateData.date_of_birth = dateOfBirth;
      updateData.employer = employer;
      updateData.position = position;
      updateData.monthly_income = parseFloat(monthlyIncome);
      updateData.employment_start_date = employmentStartDate || null;
      updateData.employer_contact = employerContact || null;
    } catch (e) {
      // Columns don't exist yet, data is in JSONB
    }

    await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);
  };

  const submitApplication = async () => {
    try {
      setSubmitting(true);
      setUploadingDocs(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !property) throw new Error('Missing required data');

      // Upload ID document
      const idResult = await uploadFile('ID_DOCUMENTS', idDocFile!, user.id);
      if (idResult.error) throw new Error(`Failed to upload ID document: ${idResult.error}`);

      // Upload proof of income files
      const incomeUrls: string[] = [];
      for (const file of incomeDocFiles) {
        const result = await uploadFile('PROOF_OF_INCOME', file, user.id);
        if (result.error) throw new Error(`Failed to upload proof of income: ${result.error}`);
        incomeUrls.push(result.url);
      }

      // Upload reference files (optional)
      const refUrls: string[] = [];
      for (const file of referenceDocFiles) {
        const result = await uploadFile('DOCUMENTS', file, `${user.id}/references`);
        if (!result.error) refUrls.push(result.url);
      }

      setUploadingDocs(false);

      // Update profile first
      await updateProfile(user.id);

      // Create application with document URLs
      const application = await applicationsApi.createApplication({
        property_id: propertyId,
        tenant_id: user.id,
        owner_id: property.owner_id,
        full_name: fullName,
        email: email,
        phone: phone,
        id_number: idNumber,
        date_of_birth: dateOfBirth,
        employer: employer,
        position: position,
        monthly_income: parseFloat(monthlyIncome),
        employment_start_date: employmentStartDate || undefined,
        employer_contact: employerContact || undefined,
        id_document_url: idResult.url,
        proof_of_income_urls: incomeUrls,
        reference_urls: refUrls.length > 0 ? refUrls : undefined,
      });

      await applicationsApi.submitApplication(application.id);

      Alert.alert(
        'Application Submitted',
        'Your application has been submitted! Track its status and respond to any holding deposit requests from the owner.',
        [
          {
            text: 'Track Application',
            onPress: () => router.push('/(tenant)/application-status' as any),
          },
        ]
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setSubmitting(false);
      setUploadingDocs(false);
    }
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

  if (!property) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Property not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const STEPS = ['Personal', 'Employment', 'Documents', 'Review'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Apply for Property</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Progress Steps — 4 steps */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            {STEPS.map((_, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <View style={[styles.progressLine, currentStep >= i + 1 && styles.progressLineActive]} />
                )}
                <View style={[styles.progressStep, currentStep >= i + 1 && styles.progressStepActive]}>
                  <Text style={[styles.progressStepText, currentStep >= i + 1 && styles.progressStepTextActive]}>
                    {i + 1}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>
          <View style={styles.progressLabels}>
            {STEPS.map((label) => (
              <Text key={label} style={styles.progressLabel}>{label}</Text>
            ))}
          </View>
        </View>

        {/* Property Summary */}
        <View style={styles.propertyCard}>
          <Text style={styles.propertyTitle}>{property.title}</Text>
          <Text style={styles.propertyAddress}>{property.address}</Text>
          <Text style={styles.propertyRent}>R {property.rent_amount?.toLocaleString()}/month</Text>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Personal Information</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter your full name"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your.email@example.com"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number *</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+27 XX XXX XXXX"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>ID Number *</Text>
                <TextInput
                  style={styles.input}
                  value={idNumber}
                  onChangeText={setIdNumber}
                  placeholder="Enter your ID number"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Date of Birth *</Text>
                <TextInput
                  style={styles.input}
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                  placeholder="YYYY-MM-DD (e.g., 1990-05-15)"
                  placeholderTextColor="#999"
                />
                <Text style={styles.helperText}>Format: Year-Month-Day (e.g., 1990-05-15)</Text>
              </View>
            </View>
          )}

          {/* Step 2: Employment Information */}
          {currentStep === 2 && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Employment Information</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Employer *</Text>
                <TextInput
                  style={styles.input}
                  value={employer}
                  onChangeText={setEmployer}
                  placeholder="Company name"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Position *</Text>
                <TextInput
                  style={styles.input}
                  value={position}
                  onChangeText={setPosition}
                  placeholder="Your job title"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Monthly Income (Gross) *</Text>
                <TextInput
                  style={styles.input}
                  value={monthlyIncome}
                  onChangeText={setMonthlyIncome}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Employment Start Date</Text>
                <TextInput
                  style={styles.input}
                  value={employmentStartDate}
                  onChangeText={setEmploymentStartDate}
                  placeholder="YYYY-MM-DD (e.g., 2020-01-15)"
                  placeholderTextColor="#999"
                />
                <Text style={styles.helperText}>Format: Year-Month-Day (e.g., 2020-01-15)</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Employer Contact</Text>
                <TextInput
                  style={styles.input}
                  value={employerContact}
                  onChangeText={setEmployerContact}
                  placeholder="HR phone or email"
                  placeholderTextColor="#999"
                />
              </View>

              {affordabilityRatio !== null && (
                <View style={[styles.affordabilityCard, !isAffordable && styles.affordabilityWarning]}>
                  <View style={styles.affordabilityHeader}>
                    <Ionicons
                      name={isAffordable ? 'checkmark-circle' : 'warning'}
                      size={24}
                      color={isAffordable ? '#4CAF50' : '#FF9800'}
                    />
                    <Text style={styles.affordabilityTitle}>Affordability Check</Text>
                  </View>
                  <Text style={styles.affordabilityRatio}>
                    {(affordabilityRatio * 100).toFixed(1)}% of your income
                  </Text>
                  <Text style={styles.affordabilityNote}>
                    {isAffordable
                      ? '✓ Within recommended 30% threshold'
                      : '⚠ Exceeds recommended 30% threshold'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Step 3: Documents */}
          {currentStep === 3 && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Upload Documents</Text>

              {/* SA ID / Passport */}
              <View style={styles.docSection}>
                <Text style={styles.label}>SA ID / Passport *</Text>
                <Text style={styles.helperText}>Upload a clear photo or scan of your ID document</Text>

                {idDocFile ? (
                  <View style={styles.docFileRow}>
                    <Ionicons name="document-attach" size={20} color={RSA.green} />
                    <Text style={styles.docFileName} numberOfLines={1}>{idDocFile.name}</Text>
                    <TouchableOpacity onPress={() => setIdDocFile(null)}>
                      <Ionicons name="close-circle" size={22} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.docPickerRow}>
                    <TouchableOpacity style={styles.docPickerBtn} onPress={pickIdDoc}>
                      <Ionicons name="cloud-upload-outline" size={20} color={RSA.green} />
                      <Text style={styles.docPickerBtnText}>Upload</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Proof of Income */}
              <View style={styles.docSection}>
                <Text style={styles.label}>Proof of Income * (max 3)</Text>
                <Text style={styles.helperText}>Payslips, bank statements, or employment letter</Text>

                {incomeDocFiles.map((file, i) => (
                  <View key={i} style={styles.docFileRow}>
                    <Ionicons name="document-attach" size={20} color={RSA.green} />
                    <Text style={styles.docFileName} numberOfLines={1}>{file.name}</Text>
                    <TouchableOpacity onPress={() => setIncomeDocFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Ionicons name="close-circle" size={22} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                ))}

                {incomeDocFiles.length < 3 && (
                  <View style={styles.docPickerRow}>
                    <TouchableOpacity style={styles.docPickerBtn} onPress={pickIncomeDoc}>
                      <Ionicons name="add-circle-outline" size={20} color={RSA.green} />
                      <Text style={styles.docPickerBtnText}>
                        {incomeDocFiles.length > 0 ? 'Add More' : 'Upload'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* References */}
              <View style={styles.docSection}>
                <Text style={styles.label}>References (optional, max 3)</Text>
                <Text style={styles.helperText}>Previous landlord letters or character references</Text>

                {referenceDocFiles.map((file, i) => (
                  <View key={i} style={styles.docFileRow}>
                    <Ionicons name="document-attach" size={20} color={RSA.blue} />
                    <Text style={styles.docFileName} numberOfLines={1}>{file.name}</Text>
                    <TouchableOpacity onPress={() => setReferenceDocFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Ionicons name="close-circle" size={22} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                ))}

                {referenceDocFiles.length < 3 && (
                  <View style={styles.docPickerRow}>
                    <TouchableOpacity style={styles.docPickerBtn} onPress={pickReferenceDoc}>
                      <Ionicons name="add-circle-outline" size={20} color={RSA.blue} />
                      <Text style={styles.docPickerBtnText}>
                        {referenceDocFiles.length > 0 ? 'Add More' : 'Upload'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Review Your Application</Text>

              <View style={styles.reviewSection}>
                <Text style={styles.reviewSectionTitle}>Personal Information</Text>
                <ReviewRow label="Full Name" value={fullName} />
                <ReviewRow label="Email" value={email} />
                <ReviewRow label="Phone" value={phone} />
                <ReviewRow label="ID Number" value={idNumber} />
                <ReviewRow label="Date of Birth" value={dateOfBirth} />
              </View>

              <View style={styles.reviewSection}>
                <Text style={styles.reviewSectionTitle}>Employment Information</Text>
                <ReviewRow label="Employer" value={employer} />
                <ReviewRow label="Position" value={position} />
                <ReviewRow label="Monthly Income" value={`R ${parseFloat(monthlyIncome).toLocaleString()}`} />
                {employmentStartDate && <ReviewRow label="Employment Start" value={employmentStartDate} />}
                {employerContact && <ReviewRow label="Employer Contact" value={employerContact} />}
              </View>

              <View style={styles.reviewSection}>
                <Text style={styles.reviewSectionTitle}>Documents</Text>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>ID Document</Text>
                  <View style={styles.docCheckRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={[styles.reviewValue, { color: '#4CAF50' }]}>Uploaded</Text>
                  </View>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Proof of Income</Text>
                  <View style={styles.docCheckRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={[styles.reviewValue, { color: '#4CAF50' }]}>
                      {incomeDocFiles.length} file{incomeDocFiles.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <View style={[styles.reviewRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.reviewLabel}>References</Text>
                  <Text style={styles.reviewValue}>
                    {referenceDocFiles.length > 0
                      ? `${referenceDocFiles.length} file${referenceDocFiles.length !== 1 ? 's' : ''}`
                      : 'Not provided'}
                  </Text>
                </View>
              </View>

              <View style={styles.disclaimer}>
                <Ionicons name="information-circle" size={20} color="#666" />
                <Text style={styles.disclaimerText}>
                  By submitting this application, you confirm that all information provided is accurate and complete.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionBar}>
          {currentStep < 4 ? (
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <View style={styles.submittingRow}>
                  <ActivityIndicator color="#FFF" />
                  <Text style={styles.submitButtonText}>
                    {uploadingDocs ? 'Uploading documents...' : 'Submitting...'}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Submit Application</Text>
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ReviewRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.reviewRow}>
    <Text style={styles.reviewLabel}>{label}</Text>
    <Text style={styles.reviewValue}>{value}</Text>
  </View>
);

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
  errorText: {
    fontSize: 16,
    color: '#F44336',
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
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  progressContainer: {
    padding: 20,
    backgroundColor: '#FFF',
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressStep: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStepActive: {
    backgroundColor: RSA.green,
  },
  progressStepText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  progressStepTextActive: {
    color: '#FFF',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  progressLineActive: {
    backgroundColor: RSA.green,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 11,
    color: '#666',
  },
  propertyCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: RSA.green,
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
    marginBottom: 8,
  },
  propertyRent: {
    fontSize: 18,
    fontWeight: '700',
    color: RSA.green,
  },
  scrollView: {
    flex: 1,
  },
  formSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
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
  affordabilityCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  affordabilityWarning: {
    backgroundColor: '#FFF3E0',
  },
  affordabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  affordabilityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  affordabilityRatio: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  affordabilityNote: {
    fontSize: 14,
    color: '#666',
  },
  // Documents step
  docSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  docFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FAF0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  docFileName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  docPickerRow: {
    marginTop: 10,
  },
  docPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: RSA.green,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 14,
  },
  docPickerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: RSA.green,
  },
  // Review step
  reviewSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  reviewSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  reviewLabel: {
    fontSize: 14,
    color: '#666',
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  docCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionBar: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RSA.green,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RSA.green,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
