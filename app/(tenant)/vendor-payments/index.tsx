import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/shared/theme/colors';

// Safe money renderer — legacy invoices may have null/NaN amounts; a bare
// `.toLocaleString()` would crash the payments list.
const fmtMoney = (n: number | null | undefined): string => {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toLocaleString() : '0';
};

interface VendorInvoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  subtotal: number;
  vat_amount: number;
  status: string;
  created_at: string;
  vendor: {
    id: string;
    full_name: string;
    business_name: string | null;
  };
  maintenance_request: {
    id: string;
    title: string;
  };
}

export default function VendorPaymentsList() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<VendorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const maintenanceResult: any = await (supabase as any)
        .from('maintenance_invoices')
        .select(`
          id, invoice_number, total_amount, subtotal, vat_amount, status, created_at,
          vendor:profiles!vendor_id(full_name, business_name),
          maintenance_request:maintenance_requests!maintenance_request_id(title)
        `)
        .eq('payer_role', 'tenant')
        .eq('status', 'approved')
        .in('maintenance_request_id', (
          await supabase
            .from('maintenance_requests')
            .select('id')
            .eq('tenant_id', user.id)
        ).data?.map(r => r.id) || [])
        .order('created_at', { ascending: false });

      if (maintenanceResult.error) throw maintenanceResult.error;
      setInvoices((maintenanceResult.data || []) as VendorInvoice[]);
      setError(null);
    } catch (err: any) {
      console.error('Error loading vendor invoices:', err);
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInvoices();
    }, [loadInvoices])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadInvoices();
  };

  const handlePay = (invoice: VendorInvoice) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/(tenant)/vendor-payments/${invoice.id}`);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.role.tenant.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
      <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
        {/* Header */}
        <View style={{
          padding: 16,
          backgroundColor: '#FFF',
          borderBottomWidth: 1,
          borderBottomColor: '#E0E0E0',
        }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#333' }} testID="vendor-payments-title">
            Vendor Payments
          </Text>
          <Text style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
            Pay for completed maintenance work
          </Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.role.tenant.primary]} />
          }
        >
          {error && (
            <View style={{
              backgroundColor: '#FEF2F2',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#FECACA',
            }}>
              <Text style={{ color: '#991B1B', fontWeight: '600' }}>Error loading invoices</Text>
              <Text style={{ color: '#DC2626', fontSize: 13, marginTop: 4 }}>{error}</Text>
            </View>
          )}

          {invoices.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 48 }}>
              <Ionicons name="card-outline" size={64} color="#CCC" />
              <Text style={{
                fontSize: 18, fontWeight: '700', color: '#333',
                marginTop: 16, marginBottom: 8,
              }}>
                No Pending Payments
              </Text>
              <Text style={{
                fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20,
              }}>
                You have no approved vendor invoices awaiting payment.{'\n'}
                Invoices appear here after a vendor completes work and submits their invoice.
              </Text>
            </View>
          ) : (
            <Animated.View entering={FadeInDown.delay(100).duration(500)}>
              <View style={{ gap: 12 }}>
                {invoices.map((invoice) => (
                  <View
                    key={invoice.id}
                    style={{
                      backgroundColor: '#FFF',
                      borderRadius: 12,
                      padding: 16,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  >
                    {/* Top: vendor info + amount */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>
                          {invoice.vendor?.business_name || invoice.vendor?.full_name || 'Service Provider'}
                        </Text>
                        {invoice.maintenance_request && (
                          <Text style={{ fontSize: 13, color: '#666', marginTop: 2 }} numberOfLines={1}>
                            {invoice.maintenance_request.title}
                          </Text>
                        )}
                        <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }} testID="invoice-number">
                          Invoice {invoice.invoice_number}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.role.tenant.primary }}>
                        R {fmtMoney(invoice.total_amount)}
                      </Text>
                    </View>

                    {/* Divider */}
                    <View style={{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 12 }} />

                    {/* Bottom: date + pay button */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: '#999' }}>
                        Submitted {new Date(invoice.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </Text>

                      <TouchableOpacity
                        testID="pay-now"
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: colors.role.tenant.primary,
                          paddingHorizontal: 20,
                          paddingVertical: 10,
                          borderRadius: 8,
                          gap: 6,
                        }}
                        onPress={() => handlePay(invoice)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="card-outline" size={18} color="#FFF" />
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFF' }}>
                          Pay Now
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
