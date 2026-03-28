import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { exportMonthlyStatementPdf } from '../utils/pdfReports';

const RSA = { blue: '#002395', gold: '#FFB81C', green: '#007A4D' };

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface PropertyStatement {
  propertyId: string;
  propertyTitle: string;
  tenantName: string;
  rentBilled: number;
  rentCollected: number;
  maintenanceCost: number;
}

interface MonthlyData {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  totalMaintenance: number;
  netIncome: number;
  properties: PropertyStatement[];
}

export default function OwnerMonthlyStatementScreen() {
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<MonthlyData | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadStatement();
    }, [month, year])
  );

  const loadStatement = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setOwnerId(user.id);

      const monthStart = new Date(year, month, 1).toISOString();
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      // Fetch payments for this month from owner's leases
      const { data: payments } = await supabase
        .from('payments')
        .select(`
          amount, status, paid_date,
          leases!inner(
            id, monthly_rent, owner_id,
            properties!property_id(id, title),
            profiles!tenant_id(full_name)
          )
        `)
        .eq('leases.owner_id', user.id)
        .gte('paid_date', monthStart)
        .lte('paid_date', monthEnd);

      // Fetch active leases to compute billed amounts
      const { data: activeLeases } = await supabase
        .from('leases')
        .select(`
          id, monthly_rent,
          properties!property_id(id, title),
          profiles!tenant_id(full_name)
        `)
        .eq('owner_id', user.id)
        .eq('status', 'active');

      // Fetch maintenance/PO costs for this month
      const { data: pos } = await supabase
        .from('purchase_orders')
        .select(`
          total_amount,
          maintenance_requests!inner(
            property_id,
            properties!property_id(id, title, owner_id)
          )
        `)
        .eq('maintenance_requests.properties.owner_id', user.id)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd)
        .eq('status', 'paid');

      // Build per-property map
      const propertyMap = new Map<string, PropertyStatement>();

      // Init from active leases (billed)
      for (const lease of activeLeases || []) {
        const prop = (lease as any).properties;
        const tenant = (lease as any).profiles;
        if (!prop) continue;
        const key = prop.id;
        propertyMap.set(key, {
          propertyId: prop.id,
          propertyTitle: prop.title || 'Property',
          tenantName: tenant?.full_name || 'Tenant',
          rentBilled: lease.monthly_rent || 0,
          rentCollected: 0,
          maintenanceCost: 0,
        });
      }

      // Add collected payments
      for (const payment of payments || []) {
        const lease = (payment as any).leases;
        const prop = lease?.properties;
        if (!prop) continue;
        const key = prop.id;
        const existing = propertyMap.get(key);
        if (existing && payment.status === 'completed') {
          existing.rentCollected += payment.amount || 0;
        }
      }

      // Add maintenance costs
      for (const po of pos || []) {
        const req = (po as any).maintenance_requests;
        const prop = req?.properties;
        if (!prop) continue;
        const key = prop.id;
        const existing = propertyMap.get(key);
        if (existing) {
          existing.maintenanceCost += po.total_amount || 0;
        } else {
          propertyMap.set(key, {
            propertyId: prop.id,
            propertyTitle: prop.title || 'Property',
            tenantName: '—',
            rentBilled: 0,
            rentCollected: 0,
            maintenanceCost: po.total_amount || 0,
          });
        }
      }

      const properties = Array.from(propertyMap.values());
      const totalBilled = properties.reduce((s, p) => s + p.rentBilled, 0);
      const totalCollected = properties.reduce((s, p) => s + p.rentCollected, 0);
      const totalMaintenance = properties.reduce((s, p) => s + p.maintenanceCost, 0);

      setData({
        totalBilled,
        totalCollected,
        totalOutstanding: Math.max(0, totalBilled - totalCollected),
        totalMaintenance,
        netIncome: totalCollected - totalMaintenance,
        properties,
      });
    } catch (err) {
      console.error('Error loading monthly statement:', err);
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth()) return; // Don't go future
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const handleExportPdf = async () => {
    if (!ownerId) return;
    setExporting(true);
    try {
      const documentId = await exportMonthlyStatementPdf(ownerId, month, year);
      Alert.alert(
        'Statement Saved',
        'Your monthly statement has been saved to Documents.',
        [
          { text: 'View', onPress: () => router.push(`/(owner)/documents/${documentId}` as any) },
          { text: 'OK' },
        ],
      );
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Unable to generate PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monthly Statement</Text>
        <TouchableOpacity
          onPress={handleExportPdf}
          disabled={exporting || loading || !ownerId}
          style={styles.exportBtn}
        >
          {exporting
            ? <ActivityIndicator size="small" color={RSA.blue} />
            : <Ionicons name="download-outline" size={22} color={RSA.blue} />
          }
        </TouchableOpacity>
      </View>

      {/* Month Picker */}
      <View style={styles.monthPicker}>
        <TouchableOpacity style={styles.monthArrow} onPress={prevMonth}>
          <Ionicons name="chevron-back" size={22} color={RSA.blue} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity
          style={[styles.monthArrow, isCurrentMonth && styles.monthArrowDisabled]}
          onPress={nextMonth}
          disabled={isCurrentMonth}
        >
          <Ionicons name="chevron-forward" size={22} color={isCurrentMonth ? '#D1D5DB' : RSA.blue} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={RSA.blue} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { borderTopColor: RSA.blue }]}>
              <Text style={styles.summaryIcon}>💰</Text>
              <Text style={styles.summaryLabel}>Rent Billed</Text>
              <Text style={[styles.summaryValue, { color: RSA.blue }]}>
                {formatZAR(data?.totalBilled || 0)}
              </Text>
            </View>
            <View style={[styles.summaryCard, { borderTopColor: RSA.green }]}>
              <Text style={styles.summaryIcon}>✅</Text>
              <Text style={styles.summaryLabel}>Collected</Text>
              <Text style={[styles.summaryValue, { color: RSA.green }]}>
                {formatZAR(data?.totalCollected || 0)}
              </Text>
            </View>
            <View style={[styles.summaryCard, { borderTopColor: '#F59E0B' }]}>
              <Text style={styles.summaryIcon}>⚠️</Text>
              <Text style={styles.summaryLabel}>Outstanding</Text>
              <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
                {formatZAR(data?.totalOutstanding || 0)}
              </Text>
            </View>
            <View style={[styles.summaryCard, { borderTopColor: '#6B7280' }]}>
              <Text style={styles.summaryIcon}>🔧</Text>
              <Text style={styles.summaryLabel}>Maintenance</Text>
              <Text style={[styles.summaryValue, { color: '#6B7280' }]}>
                {formatZAR(data?.totalMaintenance || 0)}
              </Text>
            </View>
          </View>

          {/* Net Income Banner */}
          <View style={[
            styles.netBanner,
            (data?.netIncome || 0) >= 0 ? styles.netBannerPositive : styles.netBannerNegative,
          ]}>
            <Ionicons
              name={(data?.netIncome || 0) >= 0 ? 'trending-up' : 'trending-down'}
              size={24}
              color={(data?.netIncome || 0) >= 0 ? RSA.green : '#DC2626'}
            />
            <View>
              <Text style={styles.netLabel}>Net Income</Text>
              <Text style={[
                styles.netValue,
                { color: (data?.netIncome || 0) >= 0 ? RSA.green : '#DC2626' },
              ]}>
                {formatZAR(data?.netIncome || 0)}
              </Text>
            </View>
            <Text style={styles.netFormula}>= Collected − Maintenance</Text>
          </View>

          {/* Per-Property Breakdown */}
          <Text style={styles.sectionTitle}>Property Breakdown</Text>
          {(data?.properties || []).length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="home-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No active leases in {MONTHS[month]}</Text>
            </View>
          ) : (
            (data?.properties || []).map(prop => (
              <View key={prop.propertyId} style={styles.propCard}>
                <View style={styles.propHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.propTitle}>{prop.propertyTitle}</Text>
                    <Text style={styles.propTenant}>{prop.tenantName}</Text>
                  </View>
                  <View style={[
                    styles.propStatusBadge,
                    prop.rentCollected >= prop.rentBilled && prop.rentBilled > 0
                      ? styles.propStatusPaid
                      : prop.rentCollected > 0
                      ? styles.propStatusPartial
                      : styles.propStatusUnpaid,
                  ]}>
                    <Text style={styles.propStatusText}>
                      {prop.rentCollected >= prop.rentBilled && prop.rentBilled > 0
                        ? 'Paid'
                        : prop.rentCollected > 0
                        ? 'Partial'
                        : 'Unpaid'}
                    </Text>
                  </View>
                </View>
                <View style={styles.propRows}>
                  <View style={styles.propRow}>
                    <Text style={styles.propRowLabel}>Rent Billed</Text>
                    <Text style={styles.propRowValue}>{formatZAR(prop.rentBilled)}</Text>
                  </View>
                  <View style={styles.propRow}>
                    <Text style={styles.propRowLabel}>Collected</Text>
                    <Text style={[styles.propRowValue, { color: RSA.green }]}>{formatZAR(prop.rentCollected)}</Text>
                  </View>
                  {prop.maintenanceCost > 0 && (
                    <View style={styles.propRow}>
                      <Text style={styles.propRowLabel}>Maintenance</Text>
                      <Text style={[styles.propRowValue, { color: '#6B7280' }]}>-{formatZAR(prop.maintenanceCost)}</Text>
                    </View>
                  )}
                  <View style={[styles.propRow, styles.propRowTotal]}>
                    <Text style={styles.propRowTotalLabel}>Net</Text>
                    <Text style={[
                      styles.propRowTotalValue,
                      { color: (prop.rentCollected - prop.maintenanceCost) >= 0 ? RSA.green : '#DC2626' },
                    ]}>
                      {formatZAR(prop.rentCollected - prop.maintenanceCost)}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4 },
  exportBtn: { padding: 4, width: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 24,
  },
  monthArrow: { padding: 8 },
  monthArrowDisabled: { opacity: 0.3 },
  monthLabel: { fontSize: 18, fontWeight: '700', color: '#111827', minWidth: 160, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: {
    width: '47%',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderTopWidth: 3,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  summaryIcon: { fontSize: 20, marginBottom: 6 },
  summaryLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '800' },
  netBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    padding: 16,
  },
  netBannerPositive: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  netBannerNegative: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  netLabel: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  netValue: { fontSize: 22, fontWeight: '800' },
  netFormula: { fontSize: 11, color: '#9CA3AF', flex: 1, textAlign: 'right' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 4 },
  emptyBox: { alignItems: 'center', padding: 32, backgroundColor: '#FFF', borderRadius: 14 },
  emptyText: { color: '#9CA3AF', marginTop: 10, fontSize: 14 },
  propCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  propHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  propTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  propTenant: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  propStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  propStatusPaid: { backgroundColor: '#ECFDF5' },
  propStatusPartial: { backgroundColor: '#FEF3C7' },
  propStatusUnpaid: { backgroundColor: '#FEF2F2' },
  propStatusText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  propRows: { gap: 6 },
  propRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  propRowLabel: { fontSize: 13, color: '#6B7280' },
  propRowValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  propRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
    marginTop: 4,
  },
  propRowTotalLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  propRowTotalValue: { fontSize: 16, fontWeight: '800' },
});
