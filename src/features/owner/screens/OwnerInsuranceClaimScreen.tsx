/**
 * Owner Insurance Claim Screen
 *
 * Create a new insurance claim or view/update an existing one.
 * Links to maintenance requests for damage-related incidents.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/src/lib/supabase';
import { uploadFile } from '@/src/lib/storage';
import {
  insuranceClaimsApi,
  InsuranceClaim,
  InsurancePolicy,
  ClaimType,
  ClaimStatus,
  CreateClaimInput,
} from '@/src/features/insurance/api/insuranceClaims.api';
import { colors } from '@/src/shared/theme/colors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatZAR = (amount: number) =>
  `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CLAIM_TYPES: { value: ClaimType; label: string; icon: string }[] = [
  { value: 'fire_damage', label: 'Fire Damage', icon: 'flame' },
  { value: 'water_damage', label: 'Water Damage', icon: 'water' },
  { value: 'storm_damage', label: 'Storm Damage', icon: 'thunderstorm' },
  { value: 'theft', label: 'Theft', icon: 'lock-open' },
  { value: 'vandalism', label: 'Vandalism', icon: 'hammer' },
  { value: 'structural_damage', label: 'Structural', icon: 'home' },
  { value: 'electrical_damage', label: 'Electrical', icon: 'flash' },
  { value: 'plumbing', label: 'Plumbing', icon: 'water-outline' },
  { value: 'natural_disaster', label: 'Natural Disaster', icon: 'leaf' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle' },
];

const STATUS_FLOW: ClaimStatus[] = [
  'draft', 'submitted', 'acknowledged', 'assessment',
  'approved', 'partially_approved', 'paid_out', 'closed',
];

const STATUS_INFO: Record<ClaimStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#6B7280', bg: '#F3F4F6' },
  submitted: { label: 'Submitted', color: '#D97706', bg: '#FEF3C7' },
  acknowledged: { label: 'Acknowledged', color: colors.rsa.blue, bg: '#E6EBF5' },
  assessment: { label: 'Under Assessment', color: '#7C3AED', bg: '#EDE9FE' },
  approved: { label: 'Approved', color: colors.rsa.green, bg: '#E6F7F0' },
  partially_approved: { label: 'Partially Approved', color: '#16A34A', bg: '#DCFCE7' },
  rejected: { label: 'Rejected', color: colors.rsa.red, bg: '#FEF2F2' },
  paid_out: { label: 'Paid Out', color: colors.rsa.green, bg: '#E6F7F0' },
  closed: { label: 'Closed', color: '#6B7280', bg: '#F3F4F6' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function OwnerInsuranceClaimScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const claimId = params.id as string | undefined;
  const isNewClaim = !claimId || claimId === 'new';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [claim, setClaim] = useState<InsuranceClaim | null>(null);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [showPolicyPicker, setShowPolicyPicker] = useState(false);

  // Documents state
  const [claimDocuments, setClaimDocuments] = useState<any[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [addDocModal, setAddDocModal] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('photo');

  // Form state
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);
  const [claimType, setClaimType] = useState<ClaimType>('fire_damage');
  const [description, setDescription] = useState('');
  const [incidentDate, setIncidentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [estimatedCost, setEstimatedCost] = useState('');
  const [claimedAmount, setClaimedAmount] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [claimId])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const userPolicies = await insuranceClaimsApi.getOwnerPolicies(user.id);
      setPolicies(userPolicies);

      if (!isNewClaim && claimId) {
        const [claimResult, docs] = await Promise.all([
          supabase
            .from('insurance_claims')
            .select(`
              *,
              policy:insurance_policies!policy_id(policy_number, insurer_name),
              property:properties!property_id(title, address)
            `)
            .eq('id', claimId)
            .single(),
          insuranceClaimsApi.getClaimDocuments(claimId),
        ]);

        if (claimResult.error) throw claimResult.error;
        setClaim(claimResult.data as InsuranceClaim);
        setClaimDocuments(docs);
      } else if (userPolicies.length === 1) {
        setSelectedPolicy(userPolicies[0]);
      }
    } catch (err: any) {
      console.error('Error loading claim:', err);
      Alert.alert('Error', 'Failed to load claim information');
    } finally {
      setLoading(false);
    }
  };

  const handlePickAndUpload = async () => {
    if (!claim || !userId) return;
    if (!docTitle.trim()) {
      Alert.alert('Title Required', 'Please enter a document title before picking a file');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera roll access is needed to add photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}.${ext}`;

    setUploadingDoc(true);
    setAddDocModal(false);
    try {
      const uploadResult = await uploadFile(
        'DOCUMENTS',
        { uri: asset.uri, name: fileName, type: asset.mimeType || `image/${ext}` },
        `insurance-claims/${claim.id}`
      );

      if (uploadResult.error) throw new Error(uploadResult.error);

      await insuranceClaimsApi.addClaimDocument(
        claim.id,
        userId,
        docType,
        docTitle.trim(),
        uploadResult.url
      );

      const docs = await insuranceClaimsApi.getClaimDocuments(claim.id);
      setClaimDocuments(docs);
      setDocTitle('');
      setDocType('photo');
      Alert.alert('Uploaded', 'Document added to your claim.');
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleCreateClaim = async () => {
    if (!selectedPolicy) {
      Alert.alert('Required', 'Please select an insurance policy');
      return;
    }
    if (!description.trim() || description.length < 20) {
      Alert.alert('Required', 'Please provide a description of at least 20 characters');
      return;
    }
    const cost = parseFloat(estimatedCost);
    if (isNaN(cost) || cost <= 0) {
      Alert.alert('Required', 'Please enter a valid estimated cost');
      return;
    }
    if (!userId) return;

    setSubmitting(true);
    try {
      const input: CreateClaimInput = {
        policyId: selectedPolicy.id,
        propertyId: selectedPolicy.property_id,
        claimType,
        description: description.trim(),
        incidentDate,
        estimatedCost: cost,
      };

      const newClaim = await insuranceClaimsApi.createClaim(userId, input);

      Alert.alert(
        'Claim Created',
        'Your insurance claim has been saved as a draft. Review the details and submit when ready.',
        [
          {
            text: 'View Claim',
            onPress: () => {
              router.replace(`/(owner)/insurance/${newClaim.id}`);
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create claim');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitClaim = async () => {
    if (!claim) return;
    const amount = parseFloat(claimedAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Required', 'Please enter the amount you are claiming');
      return;
    }

    Alert.alert(
      'Submit Claim',
      `Submit claim for ${formatZAR(amount)} to your insurer?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            try {
              await insuranceClaimsApi.submitClaim(claim.id, amount);
              Alert.alert('Claim Submitted', 'Your insurer has been notified. Claim number will be provided once acknowledged.');
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to submit claim');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>{isNewClaim ? 'New Claim' : 'Claim Details'}</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.rsa.blue} />
        </View>
      </SafeAreaView>
    );
  }

  // ── View existing claim ────────────────────────────────────────────────────

  if (!isNewClaim && claim) {
    const statusInfo = STATUS_INFO[claim.status];
    const policy = (claim as any).policy;
    const property = (claim as any).property;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Claim Details</Text>
          <View style={[styles.statusChip, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusChipText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Claim Number (if assigned) */}
          {claim.claim_number && (
            <View style={styles.claimNumberCard}>
              <Text style={styles.claimNumberLabel}>Claim Reference</Text>
              <Text style={styles.claimNumber}>{claim.claim_number}</Text>
            </View>
          )}

          {/* Core Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Claim Information</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>
                {claim.claim_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </Text>
            </View>
            {property && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Property</Text>
                <Text style={styles.detailValue}>{property.title}</Text>
              </View>
            )}
            {policy && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Insurer</Text>
                <Text style={styles.detailValue}>{policy.insurer_name}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Incident Date</Text>
              <Text style={styles.detailValue}>
                {new Date(claim.incident_date).toLocaleDateString('en-ZA')}
              </Text>
            </View>
            <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}>
                {claim.description}
              </Text>
            </View>
          </View>

          {/* Amounts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Financial Summary</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estimated Cost</Text>
              <Text style={styles.detailValue}>{formatZAR(claim.estimated_cost)}</Text>
            </View>
            {claim.claimed_amount != null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Amount Claimed</Text>
                <Text style={styles.detailValue}>{formatZAR(claim.claimed_amount)}</Text>
              </View>
            )}
            {claim.approved_amount != null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Approved Amount</Text>
                <Text style={[styles.detailValue, { color: colors.rsa.green, fontWeight: '700' }]}>
                  {formatZAR(claim.approved_amount)}
                </Text>
              </View>
            )}
            {claim.payout_received != null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payout Received</Text>
                <Text style={[styles.detailValue, { color: colors.rsa.green, fontWeight: '800' }]}>
                  {formatZAR(claim.payout_received)}
                </Text>
              </View>
            )}
          </View>

          {/* Documents Section */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Supporting Documents</Text>
              <TouchableOpacity
                style={styles.addDocBtn}
                onPress={() => setAddDocModal(true)}
                disabled={uploadingDoc}
              >
                {uploadingDoc ? (
                  <ActivityIndicator size="small" color={colors.rsa.white} />
                ) : (
                  <>
                    <Ionicons name="add" size={16} color={colors.rsa.white} />
                    <Text style={styles.addDocBtnText}>Add Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            {claimDocuments.length === 0 ? (
              <Text style={styles.noDocsText}>
                No documents attached. Add photos of damage, police reports, or repair quotes.
              </Text>
            ) : (
              claimDocuments.map((doc) => (
                <View key={doc.id} style={styles.docRow}>
                  <Ionicons name="document-attach-outline" size={18} color={colors.rsa.blue} />
                  <View style={styles.docInfo}>
                    <Text style={styles.docTitle}>{doc.title}</Text>
                    <Text style={styles.docType}>
                      {doc.document_type} · {new Date(doc.created_at).toLocaleDateString('en-ZA')}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Submit Action (if draft) */}
          {claim.status === 'draft' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Submit Claim</Text>
              <Text style={styles.fieldLabel}>Amount to Claim (R)</Text>
              <TextInput
                style={styles.input}
                value={claimedAmount}
                onChangeText={setClaimedAmount}
                placeholder={claim.estimated_cost.toString()}
                placeholderTextColor={colors.gray[400]}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmitClaim}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.rsa.white} />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color={colors.rsa.white} />
                    <Text style={styles.submitButtonText}>Submit to Insurer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Status Progress */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Claim Progress</Text>
            <View style={styles.progressTrack}>
              {STATUS_FLOW.map((s, i) => {
                const currentIdx = STATUS_FLOW.indexOf(claim.status);
                const isActive = s === claim.status;
                const isDone = i < currentIdx;
                return (
                  <View key={s} style={styles.progressStep}>
                    <View style={[
                      styles.progressDot,
                      isActive && styles.progressDotActive,
                      isDone && styles.progressDotDone,
                    ]}>
                      {isDone && <Ionicons name="checkmark" size={10} color={colors.rsa.white} />}
                    </View>
                    <Text style={[
                      styles.progressLabel,
                      isActive && styles.progressLabelActive,
                    ]}>
                      {STATUS_INFO[s].label}
                    </Text>
                    {i < STATUS_FLOW.length - 1 && (
                      <View style={[styles.progressLine, isDone && styles.progressLineDone]} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Add Document Modal */}
        <Modal
          visible={addDocModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setAddDocModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setAddDocModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Document</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.fieldLabel}>Document Type</Text>
              <View style={styles.docTypeRow}>
                {['photo', 'quote', 'report', 'receipt', 'other'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.docTypeChip, docType === type && styles.docTypeChipActive]}
                    onPress={() => setDocType(type)}
                  >
                    <Text style={[styles.docTypeChipText, docType === type && styles.docTypeChipTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Document Title *</Text>
              <TextInput
                style={styles.modalInput}
                value={docTitle}
                onChangeText={setDocTitle}
                placeholder="e.g. Fire damage photo — kitchen"
                placeholderTextColor={colors.gray[400]}
              />
              <TouchableOpacity
                style={[styles.submitButton, { marginTop: 24 }]}
                onPress={handlePickAndUpload}
              >
                <Ionicons name="image-outline" size={18} color={colors.rsa.white} />
                <Text style={styles.submitButtonText}>Pick Photo & Upload</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  // ── Create new claim ───────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>New Insurance Claim</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Policy Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Policy</Text>
          {policies.length === 0 ? (
            <View style={styles.noPoliciesCard}>
              <Ionicons name="shield-outline" size={32} color={colors.gray[400]} />
              <Text style={styles.noPoliciesText}>
                No active insurance policies found. Add a policy before creating a claim.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.policySelector}
              onPress={() => setShowPolicyPicker(true)}
            >
              {selectedPolicy ? (
                <View style={styles.selectedPolicy}>
                  <Text style={styles.selectedPolicyName}>{selectedPolicy.insurer_name}</Text>
                  <Text style={styles.selectedPolicyNumber}>Policy: {selectedPolicy.policy_number}</Text>
                </View>
              ) : (
                <Text style={styles.policySelectorPlaceholder}>Select a policy…</Text>
              )}
              <Ionicons name="chevron-down" size={20} color={colors.gray[400]} />
            </TouchableOpacity>
          )}
        </View>

        {/* Claim Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Claim Type *</Text>
          <View style={styles.typeGrid}>
            {CLAIM_TYPES.map(ct => (
              <TouchableOpacity
                key={ct.value}
                style={[styles.typeChip, claimType === ct.value && styles.typeChipSelected]}
                onPress={() => setClaimType(ct.value)}
              >
                <Ionicons
                  name={ct.icon as any}
                  size={18}
                  color={claimType === ct.value ? colors.rsa.white : colors.text.secondary}
                />
                <Text style={[styles.typeChipText, claimType === ct.value && styles.typeChipTextSelected]}>
                  {ct.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Incident Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Incident Details</Text>

          <Text style={styles.fieldLabel}>Incident Date *</Text>
          <TextInput
            style={styles.input}
            value={incidentDate}
            onChangeText={setIncidentDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.gray[400]}
          />

          <Text style={styles.fieldLabel}>Description * (min 20 characters)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the incident, damage extent, and circumstances..."
            placeholderTextColor={colors.gray[400]}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, description.length < 20 && { color: colors.rsa.red }]}>
            {description.length}/20 minimum
          </Text>

          <Text style={styles.fieldLabel}>Estimated Repair Cost (R) *</Text>
          <TextInput
            style={styles.input}
            value={estimatedCost}
            onChangeText={setEstimatedCost}
            placeholder="e.g. 25000"
            placeholderTextColor={colors.gray[400]}
            keyboardType="numeric"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleCreateClaim}
          disabled={submitting || !selectedPolicy}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.rsa.white} />
          ) : (
            <>
              <Ionicons name="save" size={18} color={colors.rsa.white} />
              <Text style={styles.submitButtonText}>Save as Draft</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Policy Picker Modal */}
      <Modal
        visible={showPolicyPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPolicyPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPolicyPicker(false)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Policy</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView>
            {policies.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.policyOption, selectedPolicy?.id === p.id && styles.policyOptionSelected]}
                onPress={() => {
                  setSelectedPolicy(p);
                  setShowPolicyPicker(false);
                }}
              >
                <View style={styles.policyOptionLeft}>
                  <Text style={styles.policyOptionName}>{p.insurer_name}</Text>
                  <Text style={styles.policyOptionNumber}>{p.policy_number}</Text>
                  <Text style={styles.policyOptionType}>{p.policy_type}</Text>
                </View>
                {p.cover_amount && (
                  <Text style={styles.policyOptionCover}>{formatZAR(p.cover_amount)}</Text>
                )}
                {selectedPolicy?.id === p.id && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.rsa.blue} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    gap: 12,
  },
  backButton: { padding: 4 },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statusChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  claimNumberCard: {
    backgroundColor: '#E6EBF5',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  claimNumberLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.rsa.blue,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  claimNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.rsa.blue,
    letterSpacing: 1,
  },
  section: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    textAlign: 'right',
    maxWidth: '60%',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text.primary,
  },
  inputMulti: {
    minHeight: 110,
  },
  charCount: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'right',
    marginTop: 4,
  },
  noPoliciesCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  noPoliciesText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },
  policySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    padding: 14,
  },
  selectedPolicy: { gap: 2 },
  selectedPolicyName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  selectedPolicyNumber: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  policySelectorPlaceholder: {
    fontSize: 15,
    color: colors.gray[400],
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.background.secondary,
  },
  typeChipSelected: {
    backgroundColor: colors.rsa.blue,
    borderColor: colors.rsa.blue,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  typeChipTextSelected: {
    color: colors.rsa.white,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.rsa.blue,
    borderRadius: 12,
    padding: 16,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.rsa.white,
  },
  // Progress tracker
  progressTrack: {
    gap: 0,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    position: 'relative',
  },
  progressDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border.default,
    backgroundColor: colors.background.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    borderColor: colors.rsa.blue,
    backgroundColor: colors.rsa.blue,
  },
  progressDotDone: {
    borderColor: colors.rsa.green,
    backgroundColor: colors.rsa.green,
  },
  progressLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  progressLabelActive: {
    fontWeight: '700',
    color: colors.rsa.blue,
  },
  progressLine: {
    position: 'absolute',
    left: 9,
    top: 26,
    width: 2,
    height: 12,
    backgroundColor: colors.border.default,
  },
  progressLineDone: {
    backgroundColor: colors.rsa.green,
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  policyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    gap: 12,
  },
  policyOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  policyOptionLeft: { flex: 1, gap: 2 },
  policyOptionName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  policyOptionNumber: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  policyOptionType: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  policyOptionCover: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.rsa.green,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  addDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.rsa.blue,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addDocBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.rsa.white,
  },
  noDocsText: {
    fontSize: 13,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  docInfo: { flex: 1 },
  docTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  docType: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  docTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  docTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  docTypeChipActive: {
    backgroundColor: colors.rsa.blue + '20',
    borderColor: colors.rsa.blue,
  },
  docTypeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  docTypeChipTextActive: {
    color: colors.rsa.blue,
  },
  modalInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text.primary,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 32,
  },
});
