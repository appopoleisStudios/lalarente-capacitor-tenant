import { useAuth } from '@/src/contexts/AuthContext';
import {
  getMaintenanceRequestById,
  getInvoicesByRequest,
  submitInvoice,
  resubmitInvoice,
  type InvoiceLineItem,
  type MaintenanceInvoice,
} from '@/src/features/maintenance/api';
import { colors } from '@/src/shared/theme/colors';
import { InvoiceTalkBar } from '@/src/features/maintenance/components';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RSA = { blue: '#002395' };

interface LineItemEntry {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

const keyCounter = { current: 0 };
function nextKey(): string {
  keyCounter.current += 1;
  return `item_${keyCounter.current}`;
}

export default function VendorInvoiceSubmitScreen() {
  const params = useLocalSearchParams<{ id: string; edit?: string }>();
  const id = params.id;
  const editParam = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const { user } = useAuth();
  const abortRef = useRef<AbortController | null>(null);

  const [isResubmit, setIsResubmit] = useState(!!editParam);

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [payerRole, setPayerRole] = useState<'owner' | 'tenant'>('owner');
  const [lineItems, setLineItems] = useState<LineItemEntry[]>([
    { key: '1', description: '', quantity: '1', unitPrice: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [existingInvoice, setExistingInvoice] = useState<MaintenanceInvoice | null>(null);

  useEffect(() => {
    if (id) {
      abortRef.current = new AbortController();
      loadRequest();
    }
    return () => abortRef.current?.abort();
  }, [id]);

  const loadRequest = async () => {
    try {
      setLoading(true);
      const req = await getMaintenanceRequestById(id);
      if (abortRef.current?.signal.aborted) return;
      setRequest(req);

      const invoices = await getInvoicesByRequest(id);
      if (editParam) {
        const target = invoices.find((inv) => inv.id === editParam && inv.status === 'rejected');
        if (target) {
          setExistingInvoice(target);
          setNotes(target.notes || '');
          setPayerRole(target.payer_role || 'owner');
          const items: LineItemEntry[] = (target.line_items || []).map((li: any, i: number) => ({
            key: `resubmit_${i}`,
            description: li.description || '',
            quantity: String(li.quantity || 1),
            unitPrice: String(li.unit_price || 0),
          }));
          if (items.length > 0) {
            setLineItems(items);
          }
        } else {
          setIsResubmit(false);
          const talkable = invoices.find((inv) =>
            ['submitted', 'rejected', 'disputed'].includes(inv.status)
          );
          if (talkable) setExistingInvoice(talkable);
        }
      } else {
        const talkable = invoices.find((inv) =>
          ['submitted', 'rejected', 'disputed'].includes(inv.status)
        );
        if (talkable) setExistingInvoice(talkable);
      }
    } catch (error: any) {
      console.error('Error loading request:', error);
      Alert.alert('Error', 'Failed to load request details');
    } finally {
      setLoading(false);
    }
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { key: nextKey(), description: '', quantity: '1', unitPrice: '' },
    ]);
  };

  const removeLineItem = (key: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((item) => item.key !== key));
  };

  const updateLineItem = (key: string, field: keyof LineItemEntry, value: string) => {
    setLineItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    );
  };

  const calculateRowTotal = (qty: string, price: string) => {
    const q = parseFloat(qty) || 0;
    const p = parseFloat(price) || 0;
    return q * p;
  };

  const totals = React.useMemo(() => {
    const subtotal = lineItems.reduce(
      (sum, item) => sum + calculateRowTotal(item.quantity, item.unitPrice),
      0
    );
    const vat = subtotal * 0.15;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      total: Math.round((subtotal + vat) * 100) / 100,
    };
  }, [lineItems]);

  const handleSubmit = async () => {
    const validItems = lineItems.filter(
      (item) => item.description.trim() && parseFloat(item.unitPrice) > 0
    );

    if (validItems.length === 0) {
      Alert.alert(
        'No Line Items',
        'Please add at least one line item with a description and price.'
      );
      return;
    }

    const typedRequest = request as any;
    if (!typedRequest?.owner_id || !typedRequest?.property_id) {
      Alert.alert('Error', 'Request information is incomplete.');
      return;
    }

    const alertTitle = isResubmit && existingInvoice ? 'Resubmit Invoice' : 'Submit Invoice';
    const payerLabel = payerRole === 'tenant' ? 'tenant' : 'owner';
    const alertMsg =
      isResubmit && existingInvoice
        ? `Total: R ${totals.total.toLocaleString()}\n\nResubmit this updated invoice for approval?`
        : `Total: R ${totals.total.toLocaleString()}\n\nSubmit this invoice to the ${payerLabel} for approval?`;
    Alert.alert(alertTitle, alertMsg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit Invoice',
        onPress: async () => {
          try {
            setSubmitting(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            if (!user?.id) throw new Error('Not authenticated');

            const invoiceLineItems = validItems.map((item) => ({
              description: item.description.trim(),
              quantity: parseFloat(item.quantity) || 1,
              unit_price: parseFloat(item.unitPrice) || 0,
            }));

            if (isResubmit && existingInvoice) {
              await resubmitInvoice(
                existingInvoice.id,
                user.id,
                invoiceLineItems,
                notes.trim() || undefined
              );
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                'Invoice Resubmitted',
                'Your updated invoice has been sent for approval.',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } else {
              await submitInvoice(
                id,
                user.id,
                typedRequest.owner_id,
                typedRequest.property_id,
                invoiceLineItems,
                notes.trim() || undefined,
                payerRole
              );
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                'Invoice Submitted',
                'Your invoice has been sent to the owner for approval.',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            }
          } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message || 'Failed to submit invoice');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RSA.blue} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formatCurrency = (amount: number) =>
    `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isResubmit ? 'Edit & Resubmit Invoice' : 'Submit Invoice'}
        </Text>
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Request info */}
          <View style={styles.requestInfo}>
            <Text style={styles.requestTitle}>
              {(request as any)?.title || 'Maintenance Request'}
            </Text>
          </View>

          {/* Line Items */}
          <Text style={styles.sectionTitle}>Line Items</Text>
          <Text style={styles.sectionSubtitle}>
            Add the work items, quantities, and unit prices for this invoice.
          </Text>

          {lineItems.map((item, index) => (
            <View key={item.key} style={styles.lineItemCard}>
              <View style={styles.lineItemHeader}>
                <Text style={styles.lineItemNumber}>Item {index + 1}</Text>
                {lineItems.length > 1 && (
                  <TouchableOpacity onPress={() => removeLineItem(item.key)}>
                    <Ionicons name="close-circle" size={22} color={colors.error[500]} />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={styles.descriptionInput}
                placeholder="Description of work (e.g., Labour, Materials)"
                placeholderTextColor={colors.gray[400]}
                value={item.description}
                onChangeText={(v) => updateLineItem(item.key, 'description', v)}
              />

              <View style={styles.numericRow}>
                <View style={styles.numericField}>
                  <Text style={styles.fieldLabel}>Qty</Text>
                  <TextInput
                    style={styles.numericInput}
                    placeholder="1"
                    placeholderTextColor={colors.gray[400]}
                    value={item.quantity}
                    onChangeText={(v) => updateLineItem(item.key, 'quantity', v)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.numericField}>
                  <Text style={styles.fieldLabel}>Unit Price</Text>
                  <TextInput
                    style={styles.numericInput}
                    placeholder="0.00"
                    placeholderTextColor={colors.gray[400]}
                    value={item.unitPrice}
                    onChangeText={(v) => updateLineItem(item.key, 'unitPrice', v)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.numericField}>
                  <Text style={styles.fieldLabel}>Total</Text>
                  <Text style={styles.rowTotal}>
                    {formatCurrency(calculateRowTotal(item.quantity, item.unitPrice))}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addItemButton} onPress={addLineItem}>
            <Ionicons name="add-circle" size={20} color={RSA.blue} />
            <Text style={styles.addItemText}>Add Line Item</Text>
          </TouchableOpacity>

          {/* Totals Summary */}
          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>VAT (15%)</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.vat)}</Text>
            </View>
            <View style={[styles.totalRow, styles.totalRowFinal]}>
              <Text style={styles.totalLabelFinal}>Total</Text>
              <Text style={styles.totalValueFinal}>{formatCurrency(totals.total)}</Text>
            </View>
          </View>

          {existingInvoice && (
            <InvoiceTalkBar
              invoice={existingInvoice}
              role="vendor"
              accent={RSA.blue}
              onChanged={loadRequest}
            />
          )}

          {/* Rejection reason banner (resubmit mode) */}
          {isResubmit && existingInvoice?.rejection_reason && (
            <View
              style={{
                backgroundColor: colors.error[50],
                padding: 12,
                borderRadius: 8,
                marginBottom: 16,
                borderLeftWidth: 4,
                borderLeftColor: colors.error[500],
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: colors.error[700],
                  marginBottom: 4,
                }}
              >
                Rejection Reason
              </Text>
              <Text style={{ fontSize: 13, color: colors.error[600], lineHeight: 18 }}>
                {existingInvoice.rejection_reason}
              </Text>
            </View>
          )}

          {/* Payer Selection (hidden in resubmit mode — keep original payer) */}
          {!isResubmit && (
            <>
              <Text style={styles.sectionTitle}>Who Pays?</Text>
              <Text style={styles.sectionSubtitle}>
                Select who will be responsible for paying this invoice.
              </Text>

              <View style={styles.payerRow}>
                <TouchableOpacity
                  style={[styles.payerOption, payerRole === 'owner' && styles.payerOptionActive]}
                  onPress={() => setPayerRole('owner')}
                >
                  <Ionicons
                    name={payerRole === 'owner' ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={payerRole === 'owner' ? RSA.blue : colors.gray[400]}
                  />
                  <View style={styles.payerTextWrap}>
                    <Text
                      style={[styles.payerLabel, payerRole === 'owner' && styles.payerLabelActive]}
                    >
                      Owner Pays
                    </Text>
                    <Text style={styles.payerDesc}>
                      Landlord pays from rental income or directly
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.payerOption, payerRole === 'tenant' && styles.payerOptionActive]}
                  onPress={() => setPayerRole('tenant')}
                >
                  <Ionicons
                    name={payerRole === 'tenant' ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={payerRole === 'tenant' ? RSA.blue : colors.gray[400]}
                  />
                  <View style={styles.payerTextWrap}>
                    <Text
                      style={[styles.payerLabel, payerRole === 'tenant' && styles.payerLabelActive]}
                    >
                      Tenant Pays
                    </Text>
                    <Text style={styles.payerDesc}>Tenant pays directly via PayFast checkout</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Notes */}
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Additional notes for the owner..."
            placeholderTextColor={colors.gray[400]}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          accessibilityLabel="Submit invoice for approval"
          accessibilityRole="button"
          style={[styles.submitButton, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>
                {isResubmit ? 'Resubmit' : 'Submit Invoice'} — {formatCurrency(totals.total)}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1, textAlign: 'center' },

  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },

  requestInfo: { marginBottom: 20 },
  requestTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 18 },

  lineItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  lineItemNumber: { fontSize: 13, fontWeight: '700', color: RSA.blue },
  descriptionInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  numericRow: { flexDirection: 'row', gap: 8 },
  numericField: { flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  numericInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    textAlign: 'center',
  },
  rowTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },

  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: RSA.blue,
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  addItemText: { fontSize: 14, fontWeight: '700', color: RSA.blue },

  totalsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  totalRowFinal: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 4,
    paddingTop: 12,
  },
  totalLabel: { fontSize: 14, color: '#6b7280' },
  totalValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  totalLabelFinal: { fontSize: 16, fontWeight: '700', color: '#111827' },
  totalValueFinal: { fontSize: 18, fontWeight: '800', color: RSA.blue },

  // ─── Payer selector ─────────────────────────────────────────────
  payerRow: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 20,
  },
  payerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  payerOptionActive: {
    borderColor: RSA.blue,
    backgroundColor: '#f0f5ff',
  },
  payerTextWrap: {
    flex: 1,
  },
  payerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  payerLabelActive: {
    color: RSA.blue,
  },
  payerDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  notesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 80,
  },

  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: RSA.blue,
    borderRadius: 12,
  },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
