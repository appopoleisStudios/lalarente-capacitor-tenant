import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/src/lib/supabase';

interface PaymentStatus {
  payment_status: string;
  payout_status: string;
  total_amount: number;
  platform_fee: number;
  vendor_payout: number;
  invoice_number: string;
  receipt_url?: string | null;
}

export default function VendorPaymentResult() {
  const router = useRouter();
  const { payment_id } = useLocalSearchParams<{ payment_id: string }>();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!payment_id) {
      setError('No payment reference found');
      setLoading(false);
      return;
    }

    // Poll for status up to 15 seconds
    pollRef.current = setInterval(async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const response = await fetch(
          `https://vvepwaolnkzfzhzgxlwr.supabase.co/functions/v1/get-vendor-payment-status`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ payment_id }),
          }
        );

        const data = await response.json();

        if (response.ok && data) {
          setStatus(data as PaymentStatus);

          if (
            data.payment_status === 'completed' ||
            data.payment_status === 'failed' ||
            data.payment_status === 'cancelled'
          ) {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            setLoading(false);

            if (data.payment_status === 'completed') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              // Receipt may not be ready yet (generated async by the webhook,
              // or the payment was completed by the 15-min reconcile cron).
              // The function is idempotent + party-authorized, so request it
              // on demand and surface the URL when it resolves.
              if (!data.receipt_url) {
                try {
                  const receiptRes = await fetch(
                    `https://vvepwaolnkzfzhzgxlwr.supabase.co/functions/v1/generate-payment-receipt`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                      },
                      body: JSON.stringify({ vendor_payment_id: payment_id }),
                    }
                  );
                  const receiptData = await receiptRes.json();
                  if (receiptRes.ok && receiptData.receipt_url) {
                    setStatus((prev) =>
                      prev ? { ...prev, receipt_url: receiptData.receipt_url } : prev
                    );
                  }
                } catch (receiptErr) {
                  console.error('Receipt fetch error:', receiptErr);
                }
              }
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          }
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 2000);

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setLoading(false);
        if (!status) {
          setError(
            'Payment confirmation is taking longer than expected. Your payment may still be processing.'
          );
        }
      }
    }, 30000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [payment_id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <ActivityIndicator size="large" color="#007A4D" />
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#333', marginTop: 24 }}>
            Processing Payment
          </Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 }}>
            Please wait while we confirm your payment...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isSuccess = status?.payment_status === 'completed';

  if (error && !status) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="help-circle-outline" size={64} color="#FFB81C" />
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#333', marginTop: 16 }}>
            Checking Status
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: '#666',
              textAlign: 'center',
              marginTop: 8,
              lineHeight: 20,
            }}
          >
            {error}
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 24,
              backgroundColor: '#007A4D',
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 10,
            }}
            onPress={() => router.push('/(tenant)/vendor-payments')}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>Back to Payments</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isSuccess ? '#F0FDF4' : '#FEF2F2' }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        {/* Status icon */}
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: isSuccess ? '#007A4D' : '#DE3831',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <Ionicons name={isSuccess ? 'checkmark-circle' : 'close-circle'} size={48} color="#FFF" />
        </View>

        <Text
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: isSuccess ? '#007A4D' : '#991B1B',
            marginBottom: 8,
          }}
        >
          {isSuccess ? 'Payment Successful!' : 'Payment Failed'}
        </Text>

        <Text
          style={{
            fontSize: 14,
            color: '#666',
            textAlign: 'center',
            lineHeight: 20,
            marginBottom: 24,
          }}
        >
          {isSuccess
            ? 'Your payment has been processed successfully. The vendor will be notified and payout will be processed according to their schedule.'
            : 'Your payment was not completed. Please try again or contact support if the issue persists.'}
        </Text>

        {/* Receipt card */}
        {isSuccess && status && (
          <View
            style={{
              backgroundColor: '#FFF',
              borderRadius: 16,
              padding: 20,
              width: '100%',
              marginBottom: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 12 }}>
              Payment Summary
            </Text>

            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, color: '#666' }}>Invoice</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>
                  {status.invoice_number}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, color: '#666' }}>Total Paid</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#007A4D' }}>
                  R {status.total_amount.toLocaleString()}
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: '#F0F0F0' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: '#999' }}>Platform Fee (10%)</Text>
                <Text style={{ fontSize: 12, color: '#999' }}>
                  R {status.platform_fee.toLocaleString()}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: '#999' }}>Vendor Payout</Text>
                <Text style={{ fontSize: 12, color: '#999' }}>
                  R {status.vendor_payout.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={{ width: '100%', gap: 12 }}>
          {isSuccess ? (
            <>
              {status.receipt_url ? (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#002395',
                    borderRadius: 10,
                    padding: 16,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                  onPress={() => Linking.openURL(status.receipt_url!)}
                >
                  <Ionicons name="document-text-outline" size={20} color="#FFF" />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>
                    Download Receipt
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={{
                  backgroundColor: '#007A4D',
                  borderRadius: 10,
                  padding: 16,
                  alignItems: 'center',
                }}
                onPress={() => router.push('/(tenant)/maintenance')}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>
                  View Job Status
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  borderRadius: 10,
                  padding: 16,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
                onPress={() => router.push('/(tenant)/vendor-payments')}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#333' }}>
                  Back to Payments
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={{
                  backgroundColor: '#DE3831',
                  borderRadius: 10,
                  padding: 16,
                  alignItems: 'center',
                }}
                onPress={() => router.push('/(tenant)/vendor-payments')}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  borderRadius: 10,
                  padding: 16,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
                onPress={() => router.push('/(tenant)/vendor-payments')}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#333' }}>
                  Back to Payments
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
