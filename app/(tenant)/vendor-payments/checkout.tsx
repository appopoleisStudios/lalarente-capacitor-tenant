import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';

// The edge function's return/cancel URLs point at the vendor-payment-redirect
// function. When the hosted PayFast page navigates there (after payment or
// cancel), we intercept and route back into the app instead of showing a
// browser-style redirect page.
const REDIRECT_BASE =
  'https://vvepwaolnkzfzhzgxlwr.supabase.co/functions/v1/vendor-payment-redirect';

export default function VendorPaymentCheckout() {
  const router = useRouter();
  const { payment_id, url } = useLocalSearchParams<{
    payment_id: string;
    url: string;
  }>();
  const handledRef = useRef(false);

  const goToResult = () => {
    if (handledRef.current) return;
    handledRef.current = true;
    router.replace(`/(tenant)/vendor-payments/result?payment_id=${payment_id}`);
  };

  // Intercept navigation to the return/cancel redirect — block it inside the
  // WebView and hand control back to the app (which polls payment status).
  const shouldStart = (nav: WebViewNavigation): boolean => {
    if (handledRef.current) return false;
    if (nav.url.startsWith(REDIRECT_BASE)) {
      goToResult();
      return false;
    }
    return true;
  };

  const onNavChange = (nav: WebViewNavigation) => {
    if (handledRef.current) return;
    if (nav.url.startsWith(REDIRECT_BASE)) {
      goToResult();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
      {/* Header */}
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
        <TouchableOpacity
          testID="checkout-close"
          onPress={() => router.back()}
          style={{ marginRight: 12, padding: 4 }}
          accessibilityLabel="Close checkout"
        >
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#333' }} testID="checkout-title">
            Secure Checkout
          </Text>
          <Text style={{ fontSize: 13, color: '#666' }}>
            Complete your payment securely inside the app
          </Text>
        </View>
      </View>

      {/* Hosted payment page embedded in-app (Razorpay-style, no browser hop) */}
      {url && url.startsWith('https://') ? (
        <WebView
          source={{ uri: url }}
          style={{ flex: 1, backgroundColor: '#F5F5F5' }}
          startInLoadingState
          renderLoading={() => (
            <View
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              testID="checkout-loading"
            >
              <Text style={{ fontSize: 15, color: '#007A4D', fontWeight: '600' }}>
                Loading secure payment…
              </Text>
            </View>
          )}
          onShouldStartLoadWithRequest={shouldStart}
          onNavigationStateChange={onNavChange}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="alert-circle-outline" size={48} color="#DE3831" />
          <Text style={{ fontSize: 15, color: '#666', marginTop: 12 }}>
            Payment link is missing. Please go back and try again.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
