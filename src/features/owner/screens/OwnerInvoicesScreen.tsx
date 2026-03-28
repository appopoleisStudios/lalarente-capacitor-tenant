/**
 * Owner Invoices Screen
 *
 * Shows both rent invoices (owner-tenant) and vendor invoices (owner-vendor via POs).
 * Two tabs: Rent Invoices | Vendor Invoices
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';
import { supabase } from '@/src/lib/supabase';
import {
  exportInvoicesPdf,
  exportSingleRentInvoicePdf,
  exportSingleVendorInvoicePdf,
  RentInvoiceRow,
  VendorInvoiceRow,
} from '../utils/pdfReports';

type Tab = 'rent' | 'vendor';
type RentInvoice = RentInvoiceRow;
type VendorInvoice = VendorInvoiceRow;

const STATUS_COLORS: Record<string, string> = {
  completed: colors.primary[500],
  paid: colors.primary[500],
  pending: colors.warning[500],
  overdue: colors.error[500],
  approved: colors.info[500],
  sent: colors.info[500],
  draft: colors.gray[400],
  cancelled: colors.gray[400],
};

export default function OwnerInvoicesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('rent');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState('Property Owner');
  const [rentInvoices, setRentInvoices] = useState<RentInvoice[]>([]);
  const [vendorInvoices, setVendorInvoices] = useState<VendorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [rowExporting, setRowExporting] = useState<string | null>(null);

  useEffect(() => {
    initOwner();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ownerId) fetchAll(ownerId);
    }, [ownerId])
  );

  const initOwner = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setOwnerId(user.id);
      fetchAll(user.id);
      supabase.from('profiles').select('full_name').eq('id', user.id).single()
        .then(({ data }) => { if (data?.full_name) setOwnerName(data.full_name); });
    }
  };

  const handleExportPdf = async () => {
    if (!ownerId) return;
    setExporting(true);
    try {
      const documentId = await exportInvoicesPdf(
        ownerName, ownerId, activeTab, rentInvoices, vendorInvoices,
      );
      Alert.alert(
        'Invoice Saved',
        `Your ${activeTab === 'rent' ? 'rent' : 'vendor'} invoices have been saved to Documents.`,
        [
          { text: 'View', onPress: () => router.push(`/(owner)/documents/${documentId}` as any) },
          { text: 'OK' },
        ],
      );
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Unable to generate PDF.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportSingleRent = async (invoice: RentInvoice) => {
    if (!ownerId || rowExporting) return;
    setRowExporting(invoice.id);
    try {
      const documentId = await exportSingleRentInvoicePdf(ownerName, ownerId, invoice);
      Alert.alert('Invoice Saved', `INV-${invoice.id.slice(0, 8).toUpperCase()} saved to Documents.`, [
        { text: 'View', onPress: () => router.push(`/(owner)/documents/${documentId}` as any) },
        { text: 'OK' },
      ]);
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Unable to generate PDF.');
    } finally {
      setRowExporting(null);
    }
  };

  const handleExportSingleVendor = async (po: VendorInvoice) => {
    if (!ownerId || rowExporting) return;
    setRowExporting(po.id);
    try {
      const documentId = await exportSingleVendorInvoicePdf(ownerName, ownerId, po);
      Alert.alert('PO Saved', `${po.po_number} saved to Documents.`, [
        { text: 'View', onPress: () => router.push(`/(owner)/documents/${documentId}` as any) },
        { text: 'OK' },
      ]);
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Unable to generate PDF.');
    } finally {
      setRowExporting(null);
    }
  };

  const fetchAll = async (uid: string) => {
    setLoading(true);
    await Promise.all([fetchRentInvoices(uid), fetchVendorInvoices(uid)]);
    setLoading(false);
  };

  const fetchRentInvoices = async (uid: string) => {
    try {
      // Get properties owned by this owner
      const { data: properties } = await supabase
        .from('properties')
        .select('id, title')
        .eq('owner_id', uid);

      if (!properties?.length) return;

      const propertyIds = properties.map(p => p.id);
      const propertyMap: Record<string, string> = {};
      properties.forEach(p => { propertyMap[p.id] = p.title; });

      // Get payments for these properties
      const { data: payments } = await supabase
        .from('payments')
        .select('id, amount, paid_date, due_date, status, tenant_id, property_id')
        .in('property_id', propertyIds)
        .order('due_date', { ascending: false })
        .limit(50);

      if (!payments?.length) return;

      // Get tenant names
      const tenantIds = [...new Set(payments.map(p => p.tenant_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', tenantIds);

      const tenantMap: Record<string, string> = {};
      profiles?.forEach(p => { tenantMap[p.id] = p.full_name; });

      setRentInvoices(payments.map(p => ({
        id: p.id,
        amount: p.amount,
        paid_date: p.paid_date,
        due_date: p.due_date,
        status: p.status,
        tenant_name: tenantMap[p.tenant_id] || 'Tenant',
        property_title: propertyMap[p.property_id] || 'Property',
      })));
    } catch (err) {
      console.error('Error fetching rent invoices:', err);
    }
  };

  const fetchVendorInvoices = async (uid: string) => {
    try {
      // Get maintenance requests for this owner
      const { data: requests } = await supabase
        .from('maintenance_requests')
        .select('id, title, property_id')
        .eq('owner_id', uid);

      if (!requests?.length) return;

      const requestIds = requests.map(r => r.id);
      const requestMap: Record<string, { title: string; property_id: string }> = {};
      requests.forEach(r => { requestMap[r.id] = { title: r.title ?? '', property_id: r.property_id ?? '' }; });

      // Get quotes for these requests
      const { data: quotes } = await supabase
        .from('quotes')
        .select('id, request_id, vendor_id')
        .in('request_id', requestIds);

      if (!quotes?.length) return;

      const quoteIds = quotes.map(q => q.id);
      const quoteMap: Record<string, { request_id: string; vendor_id: string }> = {};
      quotes.forEach(q => { quoteMap[q.id] = { request_id: q.request_id ?? '', vendor_id: q.vendor_id ?? '' }; });

      // Get purchase orders for these quotes
      const { data: pos } = await supabase
        .from('purchase_orders')
        .select('id, po_number, subtotal, vat_amount, total_amount, status, created_at, contract_id')
        .in('contract_id', quoteIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!pos?.length) return;

      // Get property titles
      const propertyIds = [...new Set(
        quotes.map(q => requestMap[q.request_id ?? '']?.property_id).filter(Boolean) as string[]
      )];
      const { data: propData } = await supabase
        .from('properties')
        .select('id, title')
        .in('id', propertyIds);
      const propertyMap: Record<string, string> = {};
      propData?.forEach(p => { propertyMap[p.id] = p.title; });

      // Get vendor names
      const vendorIds = [...new Set(quotes.map(q => q.vendor_id).filter(Boolean))];
      const { data: vendors } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', vendorIds);
      const vendorMap: Record<string, string> = {};
      vendors?.forEach(v => { vendorMap[v.id] = v.full_name; });

      setVendorInvoices(pos.map(po => {
        const quote = quoteMap[po.contract_id || ''];
        const reqInfo = quote ? requestMap[quote.request_id] : null;
        return {
          id: po.id,
          po_number: po.po_number,
          subtotal: po.subtotal,
          vat_amount: po.vat_amount,
          total_amount: po.total_amount,
          status: po.status,
          created_at: po.created_at,
          vendor_name: quote ? (vendorMap[quote.vendor_id] || 'Vendor') : 'Vendor',
          property_title: reqInfo ? (propertyMap[reqInfo.property_id] || 'Property') : 'Property',
          request_title: reqInfo?.title || 'Maintenance',
        };
      }));
    } catch (err) {
      console.error('Error fetching vendor invoices:', err);
    }
  };

  const formatCurrency = (amount: number) =>
    `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const rentTotal = rentInvoices
    .filter(i => i.status === 'completed')
    .reduce((sum, i) => sum + i.amount, 0);

  const vendorTotal = vendorInvoices
    .filter(i => ['approved', 'paid', 'sent'].includes(i.status))
    .reduce((sum, i) => sum + (i.total_amount || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invoices</Text>
        <TouchableOpacity
          onPress={handleExportPdf}
          disabled={exporting || loading}
          style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          {exporting
            ? <ActivityIndicator size="small" color={colors.rsa.blue} />
            : <Ionicons name="download-outline" size={22} color={colors.rsa.blue} />
          }
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'rent' && styles.tabActive]}
          onPress={() => setActiveTab('rent')}
        >
          <Text style={[styles.tabText, activeTab === 'rent' && styles.tabTextActive]}>
            Rent Invoices
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vendor' && styles.tabActive]}
          onPress={() => setActiveTab('vendor')}
        >
          <Text style={[styles.tabText, activeTab === 'vendor' && styles.tabTextActive]}>
            Vendor Invoices
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'rent' ? (
            <>
              {/* Rent summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Collected (All Time)</Text>
                <Text style={styles.summaryValue}>{formatCurrency(rentTotal)}</Text>
              </View>

              {rentInvoices.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="receipt-outline" size={48} color={colors.gray[300]} />
                  <Text style={styles.emptyText}>No rent invoices yet</Text>
                </View>
              ) : (
                rentInvoices.map(invoice => (
                  <View key={invoice.id} style={styles.card}>
                    <View style={styles.cardRow}>
                      <View style={styles.cardLeft}>
                        <Text style={styles.cardTitle}>{invoice.tenant_name}</Text>
                        <Text style={styles.cardSub}>{invoice.property_title}</Text>
                        <Text style={styles.cardDate}>
                          Due: {formatDate(invoice.due_date)}
                          {invoice.paid_date ? `  ·  Paid: ${formatDate(invoice.paid_date)}` : ''}
                        </Text>
                      </View>
                      <View style={styles.cardRight}>
                        <Text style={styles.cardAmount}>{formatCurrency(invoice.amount)}</Text>
                        <View style={styles.cardRightBottom}>
                          <View style={[
                            styles.statusBadge,
                            { backgroundColor: (STATUS_COLORS[invoice.status] || colors.gray[400]) + '20' },
                          ]}>
                            <Text style={[
                              styles.statusText,
                              { color: STATUS_COLORS[invoice.status] || colors.gray[400] },
                            ]}>
                              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleExportSingleRent(invoice)}
                            disabled={!!rowExporting}
                            style={styles.rowDownload}
                          >
                            {rowExporting === invoice.id
                              ? <ActivityIndicator size="small" color={colors.rsa.blue} />
                              : <Ionicons name="download-outline" size={16} color={colors.rsa.blue} />
                            }
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </>
          ) : (
            <>
              {/* Vendor summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Vendor Spend</Text>
                <Text style={styles.summaryValue}>{formatCurrency(vendorTotal)}</Text>
              </View>

              {vendorInvoices.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="construct-outline" size={48} color={colors.gray[300]} />
                  <Text style={styles.emptyText}>No vendor invoices yet</Text>
                </View>
              ) : (
                vendorInvoices.map(po => (
                  <View key={po.id} style={styles.card}>
                    <View style={styles.cardRow}>
                      <View style={styles.cardLeft}>
                        <Text style={styles.cardTitle}>{po.vendor_name}</Text>
                        <Text style={styles.cardSub}>{po.request_title} · {po.property_title}</Text>
                        <Text style={styles.cardDate}>PO {po.po_number} · {formatDate(po.created_at)}</Text>
                        {po.vat_amount ? (
                          <Text style={styles.cardVat}>
                            Subtotal {formatCurrency(po.subtotal || 0)} + VAT {formatCurrency(po.vat_amount)}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.cardRight}>
                        <Text style={styles.cardAmount}>{formatCurrency(po.total_amount || 0)}</Text>
                        <View style={styles.cardRightBottom}>
                          <View style={[
                            styles.statusBadge,
                            { backgroundColor: (STATUS_COLORS[po.status] || colors.gray[400]) + '20' },
                          ]}>
                            <Text style={[
                              styles.statusText,
                              { color: STATUS_COLORS[po.status] || colors.gray[400] },
                            ]}>
                              {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleExportSingleVendor(po)}
                            disabled={!!rowExporting}
                            style={styles.rowDownload}
                          >
                            {rowExporting === po.id
                              ? <ActivityIndicator size="small" color={colors.rsa.blue} />
                              : <Ionicons name="download-outline" size={16} color={colors.rsa.blue} />
                            }
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.rsa.blue,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: colors.rsa.blue,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: colors.rsa.blue,
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  card: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: {
    flex: 1,
    paddingRight: 12,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  cardDate: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  cardVat: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardRightBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  rowDownload: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.tertiary,
    marginTop: 12,
  },
});
