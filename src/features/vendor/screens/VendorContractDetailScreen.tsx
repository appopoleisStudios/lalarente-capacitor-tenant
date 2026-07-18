/**
 * Vendor Contract Detail Screen
 * Shows full details of a service contract including:
 * - Contract header (title, status, value, dates)
 * - Terms & conditions
 * - Related job/maintenance info
 * - Documents
 * - Ratings & feedback
 * - Actions (view related job, contact owner)
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/shared/theme/colors';

const BRAND_BLUE = colors.info[500];
const BRAND_GREEN = colors.success[500];

interface ContractDetail {
  id: string;
  title: string;
  status: string;
  contract_type: string | null;
  contract_value: number | null;
  start_date: string | null;
  end_date: string | null;
  completion_date: string | null;
  renewal_date: string | null;
  auto_renew: boolean | null;
  priority: string | null;
  sla_hours: number | null;
  estimated_duration_hours: number | null;
  actual_duration_hours: number | null;
  terms: Record<string, unknown> | null;
  compiled_html: string | null;
  requires_tenant_signature: boolean | null;
  termination_notice_days: number | null;
  pdf_url: string | null;
  owner_rating: number | null;
  vendor_rating: number | null;
  owner_feedback: string | null;
  vendor_feedback: string | null;
  created_at: string;
  updated_at: string | null;
  property: { id: string; title: string; address: string } | null;
  maintenance_request: { id: string; title: string; status: string } | null;
  owner: { id: string; full_name: string | null; phone: string | null; email: string | null } | null;
}

function formatCurrency(amount: number | null) {
  if (amount == null) return '—';
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function statusColor(status: string): string {
  switch (status) {
    case 'active':
    case 'in_progress':
    case 'acknowledged':
      return BRAND_GREEN;
    case 'completed':
      return colors.info[500];
    case 'expired':
    case 'terminated':
    case 'cancelled':
      return colors.error[500];
    case 'draft':
    case 'pending_owner':
    case 'pending_vendor':
    case 'pending_tenant':
    case 'quoting':
      return colors.warning[500];
    default:
      return colors.gray[400];
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active': return 'Active';
    case 'in_progress': return 'In Progress';
    case 'acknowledged': return 'Acknowledged';
    case 'completed': return 'Completed';
    case 'expired': return 'Expired';
    case 'terminated': return 'Terminated';
    case 'cancelled': return 'Cancelled';
    case 'draft': return 'Draft';
    case 'pending_owner': return 'Awaiting Owner';
    case 'pending_vendor': return 'Awaiting You';
    case 'pending_tenant': return 'Awaiting Tenant';
    case 'quoting': return 'Awaiting Quote';
    default: return status;
  }
}

function renderStars(rating: number | null): string {
  if (rating == null) return '—';
  return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
}

export default function VendorContractDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContract();
  }, [id]);

  const loadContract = async () => {
    if (!id) return;
    try {
      // Get authenticated user for ownership check
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('service_contracts')
        .select(`
          id, title, status, contract_type, contract_value,
          start_date, end_date, completion_date, renewal_date,
          auto_renew, priority, sla_hours,
          estimated_duration_hours, actual_duration_hours,
          terms, compiled_html,
          requires_tenant_signature, termination_notice_days,
          pdf_url, owner_rating, vendor_rating,
          owner_feedback, vendor_feedback,
          created_at, updated_at,
          property:property_id(id, title, address),
          maintenance_request:maintenance_request_id(id, title, status),
          owner:profiles!owner_id(id, full_name, phone, email)
        `)
        .eq('id', id)
        .eq('vendor_id', user.id)
        .single();

      if (error) {
        // Handle not-found gracefully (PGRST116)
        if ((error as any).code === 'PGRST116') {
          setContract(null);
          return;
        }
        throw error;
      }
      setContract(data as ContractDetail);
    } catch (err: any) {
      console.error('Error loading contract:', err);
      Alert.alert('Error', err.message || 'Failed to load contract');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_BLUE} />
        </View>
      </SafeAreaView>
    );
  }

  if (!contract) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contract Not Found</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="document-text-outline" size={64} color={colors.gray[200]} />
          <Text style={styles.emptyText}>This contract could not be loaded.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Contract Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroTitle}>{contract.title}</Text>
              {contract.contract_type && (
                <Text style={styles.heroType}>{contract.contract_type}</Text>
              )}
            </View>
            <View style={[styles.heroBadge, { backgroundColor: statusColor(contract.status) + '15' }]}>
              <Text style={[styles.heroBadgeText, { color: statusColor(contract.status) }]}>
                {statusLabel(contract.status)}
              </Text>
            </View>
          </View>

          {contract.contract_value != null && (
            <Text style={styles.heroValue}>{formatCurrency(contract.contract_value)}</Text>
          )}

          <View style={styles.heroDates}>
            <View style={styles.heroDateItem}>
              <Text style={styles.heroDateLabel}>Start</Text>
              <Text style={styles.heroDateValue}>{formatDate(contract.start_date)}</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color={colors.gray[300]} />
            <View style={styles.heroDateItem}>
              <Text style={styles.heroDateLabel}>End</Text>
              <Text style={styles.heroDateValue}>{formatDate(contract.end_date)}</Text>
            </View>
          </View>

          {contract.auto_renew && (
            <View style={styles.autoRenewBanner}>
              <Ionicons name="refresh" size={14} color={BRAND_GREEN} />
              <Text style={styles.autoRenewText}>Auto-renewal enabled</Text>
            </View>
          )}
        </View>

        {/* Related Info */}
        {contract.property && (
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Ionicons name="business-outline" size={18} color={BRAND_BLUE} />
              <Text style={styles.infoCardTitle}>Property</Text>
            </View>
            <Text style={styles.infoCardValue}>{contract.property.title}</Text>
            {contract.property.address && (
              <Text style={styles.infoCardSub}>{contract.property.address}</Text>
            )}
          </View>
        )}

        {contract.maintenance_request && (
          <TouchableOpacity
            style={styles.infoCard}
            onPress={() => router.push(`/(vendor)/maintenance/${contract.maintenance_request!.id}`)}
          >
            <View style={styles.infoCardHeader}>
              <Ionicons name="construct-outline" size={18} color={BRAND_BLUE} />
              <Text style={styles.infoCardTitle}>Maintenance Job</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.gray[300]} />
            </View>
            <Text style={styles.infoCardValue}>{contract.maintenance_request.title}</Text>
            <Text style={styles.infoCardSub}>Status: {contract.maintenance_request.status}</Text>
          </TouchableOpacity>
        )}

        {/* Schedule & SLA */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <Ionicons name="timer-outline" size={18} color={colors.text.primary} />
            <Text style={styles.sectionCardTitle}>Schedule & SLA</Text>
          </View>
          <View style={styles.detailGrid}>
            {contract.sla_hours != null && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>SLA (hours)</Text>
                <Text style={styles.detailValue}>{contract.sla_hours}h</Text>
              </View>
            )}
            {contract.estimated_duration_hours != null && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Est. Duration</Text>
                <Text style={styles.detailValue}>{contract.estimated_duration_hours}h</Text>
              </View>
            )}
            {contract.actual_duration_hours != null && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Actual Duration</Text>
                <Text style={styles.detailValue}>{contract.actual_duration_hours}h</Text>
              </View>
            )}
            {contract.completion_date && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Completed</Text>
                <Text style={styles.detailValue}>{formatDate(contract.completion_date)}</Text>
              </View>
            )}
            {contract.renewal_date && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Renewal</Text>
                <Text style={styles.detailValue}>{formatDate(contract.renewal_date)}</Text>
              </View>
            )}
            {contract.termination_notice_days != null && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Term. Notice</Text>
                <Text style={styles.detailValue}>{contract.termination_notice_days} days</Text>
              </View>
            )}
          </View>
        </View>

        {/* Terms */}
        {contract.terms &&
          typeof contract.terms === 'object' &&
          !Array.isArray(contract.terms) &&
          Object.keys(contract.terms).length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionCardHeader}>
              <Ionicons name="document-text-outline" size={18} color={colors.text.primary} />
              <Text style={styles.sectionCardTitle}>Terms & Conditions</Text>
            </View>
            {Object.entries(contract.terms).map(([key, value]) => (
              <View key={key} style={styles.termRow}>
                <Text style={styles.termKey}>
                  {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
                <Text style={styles.termValue}>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Contract PDF */}
        {contract.pdf_url && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Linking.openURL(contract.pdf_url!)}
          >
            <Ionicons name="document-outline" size={20} color={BRAND_BLUE} />
            <Text style={styles.actionButtonText}>View Contract Document</Text>
            <Ionicons name="open-outline" size={16} color={colors.gray[300]} />
          </TouchableOpacity>
        )}

        {/* Owner Info */}
        {contract.owner && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionCardHeader}>
              <Ionicons name="person-outline" size={18} color={colors.text.primary} />
              <Text style={styles.sectionCardTitle}>Owner</Text>
            </View>
            <Text style={styles.ownerName}>{contract.owner.full_name || 'Unknown'}</Text>
            {contract.owner.phone && (
              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => Linking.openURL(`tel:${contract.owner!.phone}`)}
              >
                <Ionicons name="call-outline" size={16} color={BRAND_BLUE} />
                <Text style={styles.contactText}>{contract.owner.phone}</Text>
              </TouchableOpacity>
            )}
            {contract.owner.email && (
              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => Linking.openURL(`mailto:${contract.owner!.email}`)}
              >
                <Ionicons name="mail-outline" size={16} color={BRAND_BLUE} />
                <Text style={styles.contactText}>{contract.owner.email}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Ratings & Feedback */}
        {(contract.owner_rating != null || contract.vendor_feedback) && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionCardHeader}>
              <Ionicons name="star-outline" size={18} color={colors.text.primary} />
              <Text style={styles.sectionCardTitle}>Feedback</Text>
            </View>
            {contract.owner_rating != null && (
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>Owner Rating:</Text>
                <Text style={styles.ratingStars}>{renderStars(contract.owner_rating)}</Text>
                <Text style={styles.ratingValue}>{contract.owner_rating}/5</Text>
              </View>
            )}
            {contract.owner_feedback && (
              <View style={styles.feedbackBox}>
                <Text style={styles.feedbackLabel}>Owner says:</Text>
                <Text style={styles.feedbackText}>"{contract.owner_feedback}"</Text>
              </View>
            )}
            {contract.vendor_rating != null && (
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>Your Rating:</Text>
                <Text style={styles.ratingStars}>{renderStars(contract.vendor_rating)}</Text>
                <Text style={styles.ratingValue}>{contract.vendor_rating}/5</Text>
              </View>
            )}
          </View>
        )}

        {/* Metadata */}
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Contract ID</Text>
            <Text style={styles.metaValue}>{contract.id.slice(0, 8)}...</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Created</Text>
            <Text style={styles.metaValue}>{formatDate(contract.created_at)}</Text>
          </View>
          {contract.updated_at && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Updated</Text>
              <Text style={styles.metaValue}>{formatDate(contract.updated_at)}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.tertiary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  // Hero Card
  heroCard: {
    backgroundColor: colors.background.default,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  heroLeft: {
    flex: 1,
    marginRight: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text.primary,
  },
  heroType: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '800',
    color: BRAND_GREEN,
    marginBottom: 12,
  },
  heroDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroDateItem: {},
  heroDateLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  heroDateValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 2,
  },
  autoRenewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.success[50],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  autoRenewText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success[700],
  },
  // Info Card
  infoCard: {
    backgroundColor: colors.background.default,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  infoCardValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  infoCardSub: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  // Section Card
  sectionCard: {
    backgroundColor: colors.background.default,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    minWidth: '45%',
  },
  detailLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 2,
  },
  // Terms
  termRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[50],
  },
  termKey: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    width: '40%',
  },
  termValue: {
    fontSize: 13,
    color: colors.text.primary,
    width: '60%',
  },
  // Action Button
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background.default,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_BLUE,
    flex: 1,
  },
  // Owner
  ownerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  contactText: {
    fontSize: 14,
    color: BRAND_BLUE,
  },
  // Ratings
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  ratingLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  ratingStars: {
    fontSize: 16,
    color: colors.secondary[500],
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  feedbackBox: {
    backgroundColor: colors.gray[50],
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  feedbackLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '600',
    marginBottom: 4,
  },
  feedbackText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  // Meta
  metaCard: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  metaValue: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
});
