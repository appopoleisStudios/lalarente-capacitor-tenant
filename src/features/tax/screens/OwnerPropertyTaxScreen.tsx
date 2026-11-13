import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';
import {
  getTaxPayments,
  createTaxPayment,
  updateTaxPayment,
  deleteTaxPayment,
  PropertyTaxPayment,
  TaxCategory,
  Deductibility,
  CATEGORY_LABELS,
  DEDUCTIBILITY_LABELS,
  CreateTaxPaymentInput,
} from '../api/propertyTaxPayments.api';
import { DateField } from '@/src/shared/components/ui/DateField';

const CATEGORIES: TaxCategory[] = [
  'municipal_rates',
  'municipal_levies',
  'sectional_title_levy',
  'bond_interest',
  'insurance',
  'other',
];

const DEDUCTIBILITIES: Deductibility[] = [
  'allowable',
  'capital',
  'mixed_use',
  'private',
  'uncertain',
];

const fmt = (n: number) =>
  `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface FormState {
  category: TaxCategory;
  description: string;
  amount: string;
  paid_on: string;
  deductibility: Deductibility;
  apportionment_pct: string;
}

const EMPTY_FORM: FormState = {
  category: 'municipal_rates',
  description: '',
  amount: '',
  paid_on: new Date().toISOString().split('T')[0],
  deductibility: 'uncertain',
  apportionment_pct: '',
};

export default function OwnerPropertyTaxScreen() {
  const { id: propertyId, title: propertyTitle } = useLocalSearchParams<{
    id: string;
    title: string;
  }>();
  const router = useRouter();

  const [payments, setPayments] = useState<PropertyTaxPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [propertyId])
  );

  const load = async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const data = await getTaxPayments(propertyId);
      setPayments(data);
    } catch {
      Alert.alert('Error', 'Could not load tax payments.');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (p: PropertyTaxPayment) => {
    setEditingId(p.id);
    setForm({
      category: p.category,
      description: p.description || '',
      amount: String(p.amount),
      paid_on: p.paid_on,
      deductibility: p.deductibility,
      apportionment_pct: p.apportionment_pct != null ? String(p.apportionment_pct) : '',
    });
    setModalVisible(true);
  };

  const handleDelete = (p: PropertyTaxPayment) => {
    Alert.alert(
      'Delete payment?',
      `${CATEGORY_LABELS[p.category]} — ${fmt(p.amount)} on ${formatDate(p.paid_on)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTaxPayment(p.id);
              setPayments((prev) => prev.filter((x) => x.id !== p.id));
            } catch {
              Alert.alert('Error', 'Could not delete payment.');
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!propertyId) return;
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0) {
      Alert.alert('Validation', 'Enter a valid amount greater than 0.');
      return;
    }
    if (!form.paid_on) {
      Alert.alert('Validation', 'Enter the date paid.');
      return;
    }
    if (form.deductibility === 'mixed_use') {
      const pct = parseFloat(form.apportionment_pct);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        Alert.alert('Validation', 'Enter an apportionment % between 0 and 100.');
        return;
      }
    }

    setSaving(true);
    try {
      const input: CreateTaxPaymentInput = {
        property_id: propertyId,
        category: form.category,
        description: form.description || undefined,
        amount,
        paid_on: form.paid_on,
        deductibility: form.deductibility,
        apportionment_pct:
          form.deductibility === 'mixed_use' ? parseFloat(form.apportionment_pct) : null,
      };

      if (editingId) {
        await updateTaxPayment(editingId, input);
        await load();
      } else {
        const created = await createTaxPayment(input);
        setPayments((prev) => [created, ...prev]);
      }
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save payment.');
    } finally {
      setSaving(false);
    }
  };

  const totalAmount = payments.reduce((s, p) => s + p.amount, 0);
  const totalDeductible = payments.reduce((s, p) => {
    if (p.deductibility === 'allowable') return s + p.amount;
    if (p.deductibility === 'mixed_use' && p.apportionment_pct != null)
      return s + p.amount * (p.apportionment_pct / 100);
    return s;
  }, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Tax Payments</Text>
          {propertyTitle ? (
            <Text style={styles.headerSub} numberOfLines={1}>
              {propertyTitle}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn} testID="add-tax-payment">
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.rsa.blue} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {payments.length > 0 && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Recorded</Text>
                <Text style={styles.summaryValue}>{fmt(totalAmount)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Deductible</Text>
                <Text style={[styles.summaryValue, { color: colors.rsa.green }]}>
                  {fmt(totalDeductible)}
                </Text>
              </View>
            </View>
          )}

          {payments.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.emptyTitle}>No tax payments recorded</Text>
              <Text style={styles.emptySub}>
                Tap + to record rates, levies, bond interest, insurance and other property expenses.
              </Text>
            </View>
          ) : (
            payments.map((p) => (
              <View key={p.id} style={styles.card} testID="tax-payment-card">
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardCategory}>{CATEGORY_LABELS[p.category]}</Text>
                    {p.description ? (
                      <Text style={styles.cardDesc} numberOfLines={1}>
                        {p.description}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.cardAmount}>{fmt(p.amount)}</Text>
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardDate}>{formatDate(p.paid_on)}</Text>
                  <View
                    style={[
                      styles.deductBadge,
                      p.deductibility === 'allowable' && styles.deductAllowable,
                      p.deductibility === 'capital' && styles.deductCapital,
                      p.deductibility === 'mixed_use' && styles.deductMixed,
                      p.deductibility === 'private' && styles.deductPrivate,
                    ]}
                  >
                    <Text style={styles.deductBadgeText}>
                      {p.deductibility === 'allowable'
                        ? 'Deductible'
                        : p.deductibility === 'capital'
                          ? 'Capital'
                          : p.deductibility === 'mixed_use'
                            ? `${p.apportionment_pct ?? '?'}% deductible`
                            : p.deductibility === 'private'
                              ? 'Private'
                              : 'Unclassified'}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => openEdit(p)}
                    style={styles.cardAction}
                    testID="edit-tax-payment"
                  >
                    <Ionicons name="pencil-outline" size={15} color={colors.rsa.blue} />
                    <Text style={styles.cardActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(p)}
                    style={styles.cardAction}
                    testID="delete-tax-payment"
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.error[500]} />
                    <Text style={[styles.cardActionText, { color: colors.error[500] }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Payment' : 'Record Payment'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Category */}
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 14 }}
              >
                <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setForm((f) => ({ ...f, category: cat }))}
                      style={[styles.chip, form.category === cat && styles.chipActive]}
                    >
                      <Text
                        style={[styles.chipText, form.category === cat && styles.chipTextActive]}
                      >
                        {CATEGORY_LABELS[cat]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Amount */}
              <Text style={styles.fieldLabel}>Amount (ZAR)</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="e.g. 1500.00"
                placeholderTextColor={colors.text.tertiary}
                value={form.amount}
                onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))}
                testID="tax-amount-input"
              />

              {/* Date */}
              <Text style={styles.fieldLabel}>Date Paid</Text>
              <DateField
                style={styles.input}
                textStyle={styles.dateFieldText}
                placeholder="Select date"
                placeholderTextColor={colors.text.tertiary}
                value={form.paid_on}
                onChange={(v) => setForm((f) => ({ ...f, paid_on: v }))}
                maximumDate={new Date()}
                testID="tax-date-input"
              />

              {/* Description */}
              <Text style={styles.fieldLabel}>Description (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Jan 2026 municipal rates"
                placeholderTextColor={colors.text.tertiary}
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              />

              {/* Deductibility */}
              <Text style={styles.fieldLabel}>Deductibility</Text>
              {DEDUCTIBILITIES.map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() =>
                    setForm((f) => ({
                      ...f,
                      deductibility: d,
                      apportionment_pct: d !== 'mixed_use' ? '' : f.apportionment_pct,
                    }))
                  }
                  style={[
                    styles.deductOption,
                    form.deductibility === d && styles.deductOptionActive,
                  ]}
                  testID={`deductibility-${d}`}
                >
                  <Ionicons
                    name={form.deductibility === d ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={form.deductibility === d ? colors.rsa.blue : colors.gray[300]}
                  />
                  <Text
                    style={[
                      styles.deductOptionText,
                      form.deductibility === d && styles.deductOptionTextActive,
                    ]}
                  >
                    {DEDUCTIBILITY_LABELS[d]}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Apportionment % — only for mixed_use */}
              {form.deductibility === 'mixed_use' && (
                <>
                  <Text style={styles.fieldLabel}>Rental Use % (deductible portion)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 70"
                    placeholderTextColor={colors.text.tertiary}
                    value={form.apportionment_pct}
                    onChangeText={(v) => setForm((f) => ({ ...f, apportionment_pct: v }))}
                    testID="tax-apportionment-input"
                  />
                </>
              )}

              <View style={{ height: 20 }} />
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              testID="save-tax-payment"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {editingId ? 'Save Changes' : 'Record Payment'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  headerSub: { fontSize: 12, color: colors.text.tertiary, marginTop: 1 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.rsa.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: colors.text.tertiary, marginBottom: 4 },
  summaryValue: { fontSize: 17, fontWeight: '800', color: colors.text.primary },
  summaryDivider: { width: 1, backgroundColor: colors.border.default },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary, marginTop: 12 },
  emptySub: {
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardCategory: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  cardDesc: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  cardAmount: { fontSize: 16, fontWeight: '800', color: colors.rsa.blue },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardDate: { fontSize: 12, color: colors.text.secondary },
  deductBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.gray[100],
  },
  deductAllowable: { backgroundColor: '#dcfce7' },
  deductCapital: { backgroundColor: '#fef9c3' },
  deductMixed: { backgroundColor: '#dbeafe' },
  deductPrivate: { backgroundColor: colors.gray[100] },
  deductBadgeText: { fontSize: 10, fontWeight: '700', color: colors.text.secondary },
  cardActions: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: 10,
  },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardActionText: { fontSize: 13, fontWeight: '600', color: colors.rsa.blue },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: colors.background.default,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text.secondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text.primary,
    marginBottom: 14,
    backgroundColor: colors.background.secondary,
  },
  dateFieldText: {
    fontSize: 15,
    color: colors.text.primary,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.background.default,
  },
  chipActive: { borderColor: colors.rsa.blue, backgroundColor: '#e8eef8' },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
  chipTextActive: { color: colors.rsa.blue },
  deductOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: colors.background.secondary,
  },
  deductOptionActive: { backgroundColor: '#e8eef8' },
  deductOptionText: { flex: 1, fontSize: 13, color: colors.text.secondary, lineHeight: 18 },
  deductOptionTextActive: { color: colors.rsa.blue, fontWeight: '600' },
  saveBtn: {
    backgroundColor: colors.rsa.blue,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
