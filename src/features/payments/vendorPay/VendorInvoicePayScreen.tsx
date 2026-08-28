import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/src/lib/supabase';
import { PaymentStepsIndicator } from '@/src/shared/components/ui/PaymentStepsIndicator';
import { EmptyState, LoadingSpinner } from '@/src/shared/components';
import type { VendorPayConfig } from './vendorPayConfig';

const fmtMoney = (n: number | null | undefined): string => {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toLocaleString() : '0';
};

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  total_amount: number;
  subtotal: number;
  vat_amount: number;
  status: string;
  payer_role: string;
  line_items: {
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
  created_at: string;
  vendor: {
    id: string;
    full_name: string;
    business_name: string | null;
  };
  maintenance_request: {
    id: string;
    title: string;
    description: string;
  };
}

export function VendorInvoicePayScreen({ config }: { config: VendorPayConfig }) {
  const router = useRouter();
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const loadInvoice = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !invoiceId) return;

      const result: any = await (supabase as any)
        .from('maintenance_invoices')
        .select(
          `
          id, invoice_number, total_amount, subtotal, vat_amount,
          status, payer_role, line_items, created_at,
          vendor:profiles!vendor_id(full_name, business_name),
          maintenance_request:maintenance_requests!maintenance_request_id(title, description)
        `
        )
        .eq('id', invoiceId)
        .single();

      if (result.error) throw result.error;
      setInvoice(result.data as InvoiceDetail);
    } catch (err) {
      console.error('Error loading invoice:', err);
      Alert.alert('Error', 'Failed to load invoice details');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [invoiceId, router]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handlePayViaPayFast = async () => {
    if (!invoice) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPaying(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        Alert.alert('Error', 'Please log in to continue');
        return;
      }

      const returnUrl = `https://vvepwaolnkzfzhzgxlwr.supabase.co/functions/v1/vendor-payment-redirect?status=success`;
      const cancelUrl = `https://vvepwaolnkzfzhzgxlwr.supabase.co/functions/v1/vendor-payment-redirect?status=cancelled`;

      const response = await fetch(
        'https://vvepwaolnkzfzhzgxlwr.supabase.co/functions/v1/create-vendor-payment-checkout',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            invoice_id: invoice.id,
            return_url: returnUrl,
            cancel_url: cancelUrl,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment checkout');
      }

      router.push({
        pathname: config.checkoutPath as any,
        params: {
          payment_id: data.payment_id,
          url: data.payfast_redirect_url,
          sandbox: data.sandbox ? '1' : '0',
        },
      });
    } catch (err: any) {
      Alert.alert('Payment Error', err.message || 'Failed to initiate payment. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen color={config.accent} />;
  }

  if (!invoice) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
        <EmptyState
          icon="🧾"
          title="Invoice not found"
          message="This invoice may have expired or been removed. Please go back and try again."
          actionLabel={config.emptyActionLabel}
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const vendorName =
    invoice.vendor?.business_name || invoice.vendor?.full_name || 'Service Provider';
  const canPay = invoice.status === 'approved' && invoice.payer_role === config.role;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
      <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
        <View
          style={{
            padding: 16,
            backgroundColor: '#FFF',
            borderBottomWidth: 1,
            borderBottomColor: '#E0E0E0',
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <View>
            <Text
              style={{ fontSize: 20, fontWeight: '700', color: '#333' }}
              testID="pay-vendor-title"
            >
              Pay Vendor
            </Text>
            <Text style={{ fontSize: 13, color: '#666' }} testID="invoice-number-detail">
              Invoice {invoice.invoice_number}
            </Text>
          </View>
        </View>

        <PaymentStepsIndicator current={0} />

        <View
          style={{
            backgroundColor: '#FFF',
            margin: 16,
            marginTop: 0,
            borderRadius: 12,
            padding: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: config.role === 'owner' ? '#E8EEF9' : '#E8F5E9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="construct-outline" size={24} color={config.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#333' }}>{vendorName}</Text>
              <Text style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                {invoice.maintenance_request?.title || 'Maintenance Job'}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: '#FFF',
            marginHorizontal: 16,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 12 }}>
            Invoice Breakdown
          </Text>

          {invoice.line_items?.map((item, index) => (
            <View
              key={index}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: '#F0F0F0',
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 14, color: '#333' }}>{item.description}</Text>
                <Text style={{ fontSize: 12, color: '#999' }}>
                  {item.quantity} × R {fmtMoney(item.unit_price)}
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>
                R {fmtMoney(item.total ?? item.quantity * item.unit_price)}
              </Text>
            </View>
          ))}

          <View style={{ marginTop: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: '#666' }}>Subtotal</Text>
              <Text style={{ fontSize: 14, color: '#333' }}>R {fmtMoney(invoice.subtotal)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: '#666' }}>VAT (15%)</Text>
              <Text style={{ fontSize: 14, color: '#333' }}>R {fmtMoney(invoice.vat_amount)}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: '#E0E0E0' }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#333' }}>Total</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: config.accent }}>
                R {fmtMoney(invoice.total_amount)}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: '#FFF',
            marginHorizontal: 16,
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Ionicons name="shield-checkmark-outline" size={20} color={config.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 }}>
                Secure Payment via PayFast
              </Text>
              <Text style={{ fontSize: 13, color: '#666', lineHeight: 18 }}>
                This release uses PayFast sandbox. Test cards only — no live money until the live
                merchant is switched after client testing.
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {canPay ? (
            <TouchableOpacity
              testID="pay-via-payfast"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: paying ? '#A3A3A3' : config.accent,
                borderRadius: 12,
                padding: 18,
                gap: 10,
              }}
              onPress={handlePayViaPayFast}
              disabled={paying}
              activeOpacity={0.8}
            >
              {paying ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="lock-closed" size={20} color="#FFF" />
              )}
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFF' }}>
                {paying ? 'Redirecting to PayFast...' : 'Pay via PayFast'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View
              style={{
                backgroundColor: '#FFF7ED',
                borderRadius: 12,
                padding: 16,
              }}
            >
              <Text style={{ fontSize: 14, color: '#9A3412', lineHeight: 20 }}>
                {invoice.payer_role !== config.role
                  ? config.role === 'owner'
                    ? 'This invoice is billed to the tenant. They pay it in the tenant app.'
                    : 'This invoice is billed to the owner. It is not paid from the tenant app.'
                  : 'This invoice is not ready to pay yet.'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={{ alignItems: 'center', padding: 12, marginTop: 8 }}
            onPress={() => router.back()}
          >
            <Text style={{ fontSize: 14, color: '#666' }}>Cancel and go back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
