/**
 * Owner Tax Report Screen
 *
 * SA tax year summary (1 March – 28/29 February).
 * Rental income, maintenance deductions, net taxable income estimate.
 * SARS ITR12 section 4 (rental income from non-trade).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';
import { supabase } from '@/src/lib/supabase';
import { exportTaxStatementPdf } from '../utils/pdfReports';

interface TaxYear {
  label: string;      // e.g. "2024/2025"
  startDate: Date;
  endDate: Date;
}

interface TaxSummary {
  grossRentalIncome: number;
  maintenanceDeductions: number;
  netTaxableEstimate: number;
  propertyBreakdown: PropertyTax[];
  paymentCount: number;
  deductionCount: number;
}

interface PropertyTax {
  propertyTitle: string;
  grossIncome: number;
  deductions: number;
  net: number;
}

function buildTaxYears(): TaxYear[] {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-based

  // SA tax year: 1 March – 28/29 Feb
  // If we're Jan/Feb, current tax year started previous March
  const latestTaxEndYear = currentMonth >= 3 ? currentYear + 1 : currentYear;

  const years: TaxYear[] = [];
  for (let i = 0; i < 3; i++) {
    const endYear = latestTaxEndYear - i;
    const startYear = endYear - 1;
    years.push({
      label: `${startYear}/${endYear}`,
      startDate: new Date(`${startYear}-03-01`),
      endDate: new Date(`${endYear}-02-28T23:59:59`),
    });
  }
  return years;
}

export default function OwnerTaxReportScreen() {
  const router = useRouter();
  const taxYears = buildTaxYears();
  const [selectedYear, setSelectedYear] = useState<TaxYear>(taxYears[0]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string>('Property Owner');
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    initOwner();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ownerId) fetchTaxData(ownerId, selectedYear);
    }, [ownerId, selectedYear])
  );

  const initOwner = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setOwnerId(user.id);
      fetchTaxData(user.id, taxYears[0]);
      // Fetch owner name for PDF
      supabase.from('profiles').select('full_name').eq('id', user.id).single()
        .then(({ data }) => { if (data?.full_name) setOwnerName(data.full_name); });
    }
  };

  const fetchTaxData = async (uid: string, taxYear: TaxYear) => {
    setLoading(true);
    try {
      // 1. Get all properties owned
      const { data: properties } = await supabase
        .from('properties')
        .select('id, title, rent_amount')
        .eq('owner_id', uid);

      if (!properties?.length) {
        setSummary({ grossRentalIncome: 0, maintenanceDeductions: 0, netTaxableEstimate: 0, propertyBreakdown: [], paymentCount: 0, deductionCount: 0 });
        setLoading(false);
        return;
      }

      const propertyIds = properties.map(p => p.id);
      const propertyMap: Record<string, string> = {};
      properties.forEach(p => { propertyMap[p.id] = p.title; });

      // 2. Completed rent payments within tax year
      const { data: payments } = await supabase
        .from('payments')
        .select('id, amount, paid_date, property_id')
        .in('property_id', propertyIds)
        .eq('status', 'completed')
        .gte('paid_date', taxYear.startDate.toISOString())
        .lte('paid_date', taxYear.endDate.toISOString());

      // 3. Maintenance deductions: POs paid within tax year for this owner's properties
      //    Chain: maintenance_requests → service_contracts → purchase_orders
      const { data: requests } = await supabase
        .from('maintenance_requests')
        .select('id, property_id')
        .eq('owner_id', uid)
        .in('property_id', propertyIds);

      let deductionsPerProperty: Record<string, number> = {};
      let deductionCount = 0;

      if (requests?.length) {
        const requestIds = requests.map(r => r.id);
        const reqPropertyMap: Record<string, string> = {};
        requests.forEach(r => { reqPropertyMap[r.id] = r.property_id ?? ''; });

        // service_contracts link maintenance_requests to purchase_orders
        const { data: contracts } = await supabase
          .from('service_contracts')
          .select('id, maintenance_request_id')
          .in('maintenance_request_id', requestIds);

        if (contracts?.length) {
          const contractIds = contracts.map(c => c.id);
          const contractRequestMap: Record<string, string> = {};
          contracts.forEach(c => { contractRequestMap[c.id] = c.maintenance_request_id ?? ''; });

          const { data: pos } = await supabase
            .from('purchase_orders')
            .select('contract_id, total_amount, created_at')
            .in('contract_id', contractIds)
            .in('status', ['approved', 'paid', 'completed'])
            .gte('created_at', taxYear.startDate.toISOString())
            .lte('created_at', taxYear.endDate.toISOString());

          deductionCount = pos?.length || 0;
          pos?.forEach(po => {
            const requestId = contractRequestMap[po.contract_id || ''];
            const propId = requestId ? reqPropertyMap[requestId] : null;
            if (propId && po.total_amount) {
              deductionsPerProperty[propId] = (deductionsPerProperty[propId] || 0) + po.total_amount;
            }
          });
        }
      }

      // 4. Build per-property breakdown
      const incomePerProperty: Record<string, number> = {};
      payments?.forEach(p => {
        if (p.property_id && p.amount) {
          incomePerProperty[p.property_id] = (incomePerProperty[p.property_id] || 0) + p.amount;
        }
      });

      const allPropertyIds = new Set([
        ...Object.keys(incomePerProperty),
        ...Object.keys(deductionsPerProperty),
      ]);

      const propertyBreakdown: PropertyTax[] = Array.from(allPropertyIds).map(pid => {
        const gross = incomePerProperty[pid] || 0;
        const deductions = deductionsPerProperty[pid] || 0;
        return {
          propertyTitle: propertyMap[pid] || 'Property',
          grossIncome: gross,
          deductions,
          net: gross - deductions,
        };
      }).sort((a, b) => b.grossIncome - a.grossIncome);

      const grossRentalIncome = propertyBreakdown.reduce((s, p) => s + p.grossIncome, 0);
      const maintenanceDeductions = propertyBreakdown.reduce((s, p) => s + p.deductions, 0);

      setSummary({
        grossRentalIncome,
        maintenanceDeductions,
        netTaxableEstimate: grossRentalIncome - maintenanceDeductions,
        propertyBreakdown,
        paymentCount: payments?.length || 0,
        deductionCount,
      });
    } catch (err) {
      console.error('Error fetching tax data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

  const handleExportPdf = async () => {
    if (!summary || !ownerId) return;
    setExporting(true);
    try {
      const documentId = await exportTaxStatementPdf(
        {
          ownerName,
          taxYearLabel: selectedYear.label,
          startDate: selectedYear.startDate.toISOString(),
          endDate: selectedYear.endDate.toISOString(),
          grossRentalIncome: summary.grossRentalIncome,
          maintenanceDeductions: summary.maintenanceDeductions,
          netTaxableEstimate: summary.netTaxableEstimate,
          paymentCount: summary.paymentCount,
          deductionCount: summary.deductionCount,
          propertyBreakdown: summary.propertyBreakdown.map(pb => ({
            propertyTitle: pb.propertyTitle,
            grossIncome: pb.grossIncome,
            deductions: pb.deductions,
            net: pb.net,
          })),
        },
        ownerId,
      );
      Alert.alert(
        'Statement Saved',
        'Your tax statement has been saved to Documents.',
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

  const isFuture = selectedYear.endDate > new Date();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tax Reports</Text>
        <TouchableOpacity
          onPress={handleExportPdf}
          disabled={exporting || loading || !summary}
          style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          {exporting
            ? <ActivityIndicator size="small" color={colors.primary[500]} />
            : <Ionicons name="download-outline" size={22} color={colors.primary[500]} />
          }
        </TouchableOpacity>
      </View>

      {/* Tax year selector */}
      <View style={styles.yearSelector}>
        {taxYears.map(ty => (
          <TouchableOpacity
            key={ty.label}
            style={[styles.yearChip, selectedYear.label === ty.label && styles.yearChipActive]}
            onPress={() => {
              setSelectedYear(ty);
              if (ownerId) fetchTaxData(ownerId, ty);
            }}
          >
            <Text style={[styles.yearChipText, selectedYear.label === ty.label && styles.yearChipTextActive]}>
              {ty.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

          {isFuture && (
            <View style={styles.notice}>
              <Ionicons name="time-outline" size={16} color={colors.warning[500]} />
              <Text style={styles.noticeText}>
                Current tax year in progress — figures are year-to-date only.
              </Text>
            </View>
          )}

          {/* Summary cards */}
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { backgroundColor: colors.primary[500] }]}>
              <Text style={styles.summaryCardLabel}>Gross Rental Income</Text>
              <Text style={styles.summaryCardValue}>{fmt(summary?.grossRentalIncome || 0)}</Text>
              <Text style={styles.summaryCardSub}>{summary?.paymentCount || 0} payments</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.error[500] }]}>
              <Text style={styles.summaryCardLabel}>Maintenance Deductions</Text>
              <Text style={styles.summaryCardValue}>{fmt(summary?.maintenanceDeductions || 0)}</Text>
              <Text style={styles.summaryCardSub}>{summary?.deductionCount || 0} POs</Text>
            </View>
          </View>

          {/* Net estimate */}
          <View style={styles.netCard}>
            <View>
              <Text style={styles.netLabel}>Net Taxable Estimate</Text>
              <Text style={styles.netSub}>ITR12 Section 4 — Rental Income</Text>
            </View>
            <Text style={styles.netValue}>{fmt(summary?.netTaxableEstimate || 0)}</Text>
          </View>

          {/* SARS disclaimer */}
          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={16} color={colors.info[500]} />
            <Text style={styles.disclaimerText}>
              This is an estimate only. Bond interest, municipal rates, insurance premiums,
              and levies are not included — add these manually. Consult a tax practitioner for
              your SARS ITR12 submission. SA tax year: 1 March – 28 February.
            </Text>
          </View>

          {/* Per-property breakdown */}
          {summary?.propertyBreakdown && summary.propertyBreakdown.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Per-Property Breakdown</Text>
              {summary.propertyBreakdown.map((pb, i) => (
                <View key={i} style={styles.propertyCard}>
                  <Text style={styles.propertyTitle}>{pb.propertyTitle}</Text>
                  <View style={styles.propertyRow}>
                    <Text style={styles.propertyLabel}>Gross Income</Text>
                    <Text style={[styles.propertyValue, { color: colors.primary[500] }]}>
                      {fmt(pb.grossIncome)}
                    </Text>
                  </View>
                  <View style={styles.propertyRow}>
                    <Text style={styles.propertyLabel}>Deductions</Text>
                    <Text style={[styles.propertyValue, { color: colors.error[500] }]}>
                      − {fmt(pb.deductions)}
                    </Text>
                  </View>
                  <View style={[styles.propertyRow, styles.propertyRowBorder]}>
                    <Text style={[styles.propertyLabel, { fontWeight: '700' }]}>Net</Text>
                    <Text style={[styles.propertyValue, { fontWeight: '700' }]}>
                      {fmt(pb.net)}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {summary?.propertyBreakdown.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="bar-chart-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.emptyText}>No rental income for this tax year</Text>
            </View>
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
  yearSelector: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
  },
  yearChipActive: {
    backgroundColor: colors.rsa.blue,
  },
  yearChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  yearChipTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warning[50],
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: colors.warning[700],
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
  },
  summaryCardLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  summaryCardValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
  },
  summaryCardSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  netCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.rsa.gold,
  },
  netLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  netSub: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  netValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.rsa.blue,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.info[50],
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: colors.info[700],
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 10,
  },
  propertyCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  propertyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 10,
  },
  propertyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  propertyRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: 6,
    marginTop: 2,
    marginBottom: 0,
  },
  propertyLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  propertyValue: {
    fontSize: 13,
    color: colors.text.primary,
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
