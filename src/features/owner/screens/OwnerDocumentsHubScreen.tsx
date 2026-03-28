/**
 * Owner Documents Hub Screen
 *
 * Hybrid approach: category tiles (quick navigation to existing screens)
 * + recent documents feed (actual files from leases, inspections, POs, insurance, deposits).
 * Filterable by category via horizontal chips.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';
import { supabase } from '@/src/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterKey = 'all' | 'leases' | 'financial' | 'inspections' | 'compliance' | 'insurance';

interface CategoryTile {
  name: string;
  icon: string;
  type: string;
  filter: FilterKey[];
}

interface RecentDocument {
  id: string;
  type: 'lease' | 'inspection' | 'purchase_order' | 'insurance' | 'deduction' | 'statement';
  title: string;
  propertyName: string;
  fileUrl: string;
  date: string;
  iconName: string;
  iconColor: string;
  filter: FilterKey;
  documentId?: string; // present for items stored in the documents table
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'leases', label: 'Leases' },
  { key: 'financial', label: 'Financial' },
  { key: 'inspections', label: 'Inspections' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'insurance', label: 'Insurance' },
];

const CATEGORY_TILES: CategoryTile[] = [
  { name: 'Lease Contracts', icon: '📄', type: 'active-leases', filter: ['all', 'leases'] },
  { name: 'Invoices', icon: '💰', type: 'recent-invoices', filter: ['all', 'financial'] },
  { name: 'Vendor Quotes', icon: '📋', type: 'pending-quotes', filter: ['all', 'financial'] },
  { name: 'Tax Reports', icon: '⚖️', type: 'tax', filter: ['all', 'financial'] },
  { name: 'Compliance', icon: '🛡️', type: 'compliance', filter: ['all', 'compliance'] },
  { name: 'Deposits', icon: '🏦', type: 'deposits', filter: ['all', 'leases'] },
  { name: 'Holding Deposits', icon: '🔒', type: 'holding-deposit', filter: ['all', 'leases'] },
  { name: 'Lease Renewals', icon: '🔄', type: 'renewals', filter: ['all', 'leases'] },
  { name: 'Insurance', icon: '📑', type: 'insurance', filter: ['all', 'insurance'] },
  { name: 'Disputes', icon: '⚖️', type: 'payment-disputes', filter: ['all', 'financial'] },
  { name: 'Inspections', icon: '🔍', type: 'inspections', filter: ['all', 'inspections'] },
  { name: 'Statements', icon: '📊', type: 'statements', filter: ['all', 'financial'] },
];

const DOC_TYPE_FILTER: Record<RecentDocument['type'], FilterKey> = {
  lease: 'leases',
  inspection: 'inspections',
  purchase_order: 'financial',
  insurance: 'insurance',
  deduction: 'leases',
  statement: 'financial',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeDate(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function handleDocumentPress(router: ReturnType<typeof useRouter>, docType: string) {
  const routes: Record<string, string> = {
    'active-leases': '/(owner)/tenants',
    'recent-invoices': '/(owner)/invoices',
    'pending-quotes': '/(owner)/maintenance',
    'tax': '/(owner)/tax-reports',
    'compliance': '/(owner)/compliance',
    'deposits': '/(owner)/deposits',
    'holding-deposit': '/(owner)/holding-deposit',
    'renewals': '/(owner)/renewals',
    'insurance': '/(owner)/insurance',
    'payment-disputes': '/(owner)/payment-disputes',
    'inspections': '/(owner)/inspections',
    'statements': '/(owner)/statements',
  };
  const route = routes[docType];
  if (route) router.push(route as any);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OwnerDocumentsHubScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    initOwner();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ownerId) fetchRecentDocuments(ownerId);
    }, [ownerId])
  );

  const initOwner = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setOwnerId(user.id);
      fetchRecentDocuments(user.id);
    }
  };

  const fetchRecentDocuments = async (uid: string) => {
    try {
      const results: RecentDocument[] = [];

      // Run all queries in parallel
      const [leaseRes, inspectionRes, poData, claimDocRes, deductionRes, statementRes] = await Promise.all([
        // 1. Signed leases with PDFs
        supabase
          .from('leases')
          .select('id, lease_document_url, executed_at, property:properties!property_id(title)')
          .eq('owner_id', uid)
          .not('lease_document_url', 'is', null)
          .order('executed_at', { ascending: false })
          .limit(10),

        // 2. Inspection reports
        supabase
          .from('inspections')
          .select('id, report_url, completed_date, type, property:properties!property_id(title)')
          .eq('owner_id', uid)
          .not('report_url', 'is', null)
          .order('completed_date', { ascending: false })
          .limit(10),

        // 3. Purchase orders — need multi-step query
        fetchPurchaseOrderDocs(uid),

        // 4. Insurance claim documents
        supabase
          .from('insurance_claim_documents')
          .select('id, file_url, title, document_type, created_at, claim:insurance_claims!claim_id(owner_id, property:properties!property_id(title))')
          .order('created_at', { ascending: false })
          .limit(20),

        // 5. Deposit deduction evidence
        supabase
          .from('deposit_deductions')
          .select('id, evidence_urls, deduction_type, created_at, lease:leases!lease_id(property:properties!property_id(title))')
          .eq('owner_id', uid)
          .not('evidence_urls', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10),

        // 6. All saved PDF reports: statements, tax, invoices, inspection reports
        supabase
          .from('documents')
          .select('id, title, file_url, type, created_at')
          .eq('owner_id', uid)
          .in('type', ['owner_statement', 'tax_statement', 'invoice', 'inspection_report'])
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      // Process leases
      if (leaseRes.data) {
        for (const l of leaseRes.data) {
          if (!l.lease_document_url) continue;
          const prop = l.property as any;
          results.push({
            id: `lease-${l.id}`,
            type: 'lease',
            title: 'Lease Agreement',
            propertyName: prop?.title || 'Property',
            fileUrl: l.lease_document_url,
            date: l.executed_at || '',
            iconName: 'document-text',
            iconColor: colors.rsa.blue,
            filter: 'leases',
          });
        }
      }

      // Process inspections
      if (inspectionRes.data) {
        for (const i of inspectionRes.data) {
          if (!i.report_url) continue;
          const prop = i.property as any;
          const typeLabel = (i.type || 'inspection').replace(/_/g, ' ');
          results.push({
            id: `insp-${i.id}`,
            type: 'inspection',
            title: `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} Report`,
            propertyName: prop?.title || 'Property',
            fileUrl: i.report_url,
            date: i.completed_date || '',
            iconName: 'clipboard',
            iconColor: colors.rsa.green,
            filter: 'inspections',
          });
        }
      }

      // Process POs
      if (poData) {
        results.push(...poData);
      }

      // Process insurance claim docs — filter to this owner
      if (claimDocRes.data) {
        for (const d of claimDocRes.data) {
          const claim = d.claim as any;
          if (claim?.owner_id !== uid) continue;
          const prop = claim?.property as any;
          results.push({
            id: `ins-${d.id}`,
            type: 'insurance',
            title: d.title || 'Claim Document',
            propertyName: prop?.title || 'Property',
            fileUrl: d.file_url,
            date: d.created_at || '',
            iconName: 'shield-checkmark',
            iconColor: '#e67e22',
            filter: 'insurance',
          });
        }
      }

      // Process deposit deductions — each evidence_url is a separate doc
      if (deductionRes.data) {
        for (const dd of deductionRes.data) {
          if (!dd.evidence_urls?.length) continue;
          const lease = dd.lease as any;
          const prop = lease?.property as any;
          const typeLabel = (dd.deduction_type || 'deduction').replace(/_/g, ' ');
          for (let i = 0; i < dd.evidence_urls.length; i++) {
            results.push({
              id: `ded-${dd.id}-${i}`,
              type: 'deduction',
              title: `Deduction Evidence — ${typeLabel}`,
              propertyName: prop?.title || 'Property',
              fileUrl: dd.evidence_urls[i],
              date: dd.created_at || '',
              iconName: 'camera',
              iconColor: colors.rsa.red,
              filter: 'leases',
            });
          }
        }
      }

      // Process saved PDF reports (owner_statement / tax_statement / invoice / inspection_report)
      if (statementRes.data) {
        for (const s of statementRes.data) {
          const iconName =
            s.type === 'tax_statement' ? 'calculator' :
            s.type === 'invoice' ? 'receipt' :
            s.type === 'inspection_report' ? 'clipboard' : 'bar-chart';
          results.push({
            id: `stmt-${s.id}`,
            type: 'statement',
            title: s.title || 'Document',
            propertyName: 'All Properties',
            fileUrl: s.file_url || '',
            date: s.created_at || '',
            iconName,
            iconColor: '#002395',
            filter: 'financial',
            documentId: s.id,
          });
        }
      }

      // Sort by date descending, take 20
      results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentDocs(results.slice(0, 20));
    } catch (err) {
      console.error('Error fetching recent documents:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /** Multi-step query for POs (same pattern as OwnerInvoicesScreen) */
  const fetchPurchaseOrderDocs = async (uid: string): Promise<RecentDocument[]> => {
    const results: RecentDocument[] = [];
    try {
      // Step 1: owner's maintenance requests
      const { data: requests } = await supabase
        .from('maintenance_requests')
        .select('id, property_id')
        .eq('owner_id', uid);
      if (!requests?.length) return results;

      const requestIds = requests.map(r => r.id);

      // Step 2: quotes for those requests
      const { data: quotes } = await supabase
        .from('quotes')
        .select('id, request_id')
        .in('request_id', requestIds);
      if (!quotes?.length) return results;

      const quoteIds = quotes.map(q => q.id);
      const quoteToRequest: Record<string, string> = {};
      quotes.forEach(q => { quoteToRequest[q.id] = q.request_id ?? ''; });

      const requestToProperty: Record<string, string> = {};
      requests.forEach(r => { requestToProperty[r.id] = r.property_id ?? ''; });

      // Step 3: POs with PDFs
      const { data: pos } = await supabase
        .from('purchase_orders')
        .select('id, po_number, pdf_url, created_at, total_amount, contract_id')
        .in('contract_id', quoteIds)
        .not('pdf_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);
      if (!pos?.length) return results;

      // Step 4: property names
      const propertyIds = [...new Set(
        pos.map(po => {
          const reqId = quoteToRequest[po.contract_id ?? ''];
          return requestToProperty[reqId];
        }).filter(Boolean)
      )];
      const { data: propData } = await supabase
        .from('properties')
        .select('id, title')
        .in('id', propertyIds);
      const propertyMap: Record<string, string> = {};
      propData?.forEach(p => { propertyMap[p.id] = p.title; });

      for (const po of pos) {
        if (!po.pdf_url) continue;
        const reqId = quoteToRequest[po.contract_id ?? ''];
        const propId = requestToProperty[reqId];
        results.push({
          id: `po-${po.id}`,
          type: 'purchase_order',
          title: `PO ${po.po_number}`,
          propertyName: propertyMap[propId] || 'Property',
          fileUrl: po.pdf_url,
          date: po.created_at || '',
          iconName: 'receipt',
          iconColor: '#8e44ad',
          filter: 'financial',
        });
      }
    } catch (err) {
      console.error('Error fetching PO documents:', err);
    }
    return results;
  };

  const handlePullToRefresh = async () => {
    if (!ownerId) return;
    setRefreshing(true);
    await fetchRecentDocuments(ownerId);
  };

  const openDocument = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Cannot Open', 'Unable to open this document.');
      }
    } catch {
      Alert.alert('Error', 'Failed to open document.');
    }
  };

  // Filtered data
  const filteredTiles = activeFilter === 'all'
    ? CATEGORY_TILES
    : CATEGORY_TILES.filter(t => t.filter.includes(activeFilter));

  const filteredDocs = activeFilter === 'all'
    ? recentDocs
    : recentDocs.filter(d => d.filter === activeFilter);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Documents</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipBar}
        contentContainerStyle={styles.chipBarContent}
      >
        {FILTERS.map(f => {
          const active = activeFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setActiveFilter(f.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handlePullToRefresh} tintColor={colors.rsa.green} />
          }
        >
          {/* Category Tiles Grid */}
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.grid}>
            {filteredTiles.map(tile => (
              <TouchableOpacity
                key={tile.type}
                style={styles.tile}
                onPress={() => handleDocumentPress(router, tile.type)}
                activeOpacity={0.7}
              >
                <Text style={styles.tileIcon}>{tile.icon}</Text>
                <Text style={styles.tileName} numberOfLines={2}>{tile.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Recent Documents Feed */}
          <Text style={styles.sectionTitle}>Recent Documents</Text>

          {filteredDocs.length === 0 ? (
            <View style={styles.emptyFeed}>
              <Ionicons name="folder-open-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.emptyText}>
                {activeFilter === 'all'
                  ? 'No documents yet. Documents will appear here as you use the platform.'
                  : `No ${FILTERS.find(f => f.key === activeFilter)?.label.toLowerCase()} documents found.`}
              </Text>
            </View>
          ) : (
            filteredDocs.map(doc => (
              <View key={doc.id} style={styles.docRow}>
                <View style={[styles.docIconCircle, { backgroundColor: doc.iconColor + '18' }]}>
                  <Ionicons name={doc.iconName as any} size={20} color={doc.iconColor} />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle} numberOfLines={1}>{doc.title}</Text>
                  <Text style={styles.docProperty} numberOfLines={1}>{doc.propertyName}</Text>
                  <Text style={styles.docDate}>{doc.date ? relativeDate(doc.date) : ''}</Text>
                </View>
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() =>
                    doc.documentId
                      ? router.push(`/(owner)/documents/${doc.documentId}` as any)
                      : openDocument(doc.fileUrl)
                  }
                >
                  <Ionicons name="open-outline" size={16} color={colors.rsa.blue} />
                  <Text style={styles.viewBtnText}>View</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
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
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },

  // Filter chips
  chipBar: {
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    maxHeight: 52,
  },
  chipBarContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  chipActive: {
    backgroundColor: colors.rsa.blue,
    borderColor: colors.rsa.blue,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text.secondary },
  chipTextActive: { color: '#ffffff' },

  content: { flex: 1, padding: 16 },

  // Section titles
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginBottom: 12, marginTop: 4 },

  // Category tiles
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  tile: {
    width: '31%',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tileIcon: { fontSize: 24, marginBottom: 6 },
  tileName: { fontSize: 11, fontWeight: '600', color: colors.text.primary, textAlign: 'center' },

  // Recent documents feed
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  docIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  docInfo: { flex: 1, marginRight: 10 },
  docTitle: { fontSize: 13, fontWeight: '600', color: colors.text.primary },
  docProperty: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  docDate: { fontSize: 11, color: colors.text.tertiary, marginTop: 2 },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.rsa.blue + '12',
    borderWidth: 1,
    borderColor: colors.rsa.blue + '30',
  },
  viewBtnText: { fontSize: 12, fontWeight: '600', color: colors.rsa.blue },

  // Empty state
  emptyFeed: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 13, color: colors.text.secondary, textAlign: 'center', marginTop: 12, lineHeight: 18, paddingHorizontal: 20 },
});
