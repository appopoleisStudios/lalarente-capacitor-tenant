import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { PaymentStepsIndicator } from '@/src/shared/components/ui/PaymentStepsIndicator';
import { ErrorState, FeaturePin, LoadingSpinner } from '@/src/shared/components';

// The edge function's return/cancel URLs point at the vendor-payment-redirect
// function. When the hosted PayFast page navigates there (after payment or
// cancel), we intercept and route back into the app instead of showing a
// browser-style redirect page.
const REDIRECT_BASE =
  'https://vvepwaolnkzfzhzgxlwr.supabase.co/functions/v1/vendor-payment-redirect';

// ── Security allowlist ────────────────────────────────────────────────────
// The checkout frame renders under a trusted "Secure Checkout" header, but the
// initial URL arrives via route params — which anyone can forge by deep-linking
// with a crafted ?url=. A bare https:// check would happily render a phishing
// page inside our branded frame. So the INITIAL URL host is restricted to
// *.payfast.co.za (the edge function always generates sandbox.payfast.co.za or
// www.payfast.co.za). Later in-page navigations (3DS, bank confirmations) stay
// open — only the first load is restricted.
const isPayFastUrl = (rawUrl: string | undefined | null): boolean => {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'payfast.co.za' || host.endsWith('.payfast.co.za');
  } catch {
    return false;
  }
};

export default function VendorPaymentCheckout() {
  const router = useRouter();
  const { payment_id, url } = useLocalSearchParams<{
    payment_id: string;
    url: string;
  }>();
  const handledRef = useRef(false);

  const goToResult = () => {
    // Mark handled FIRST: both onShouldStartLoadWithRequest and
    // onNavigationStateChange fire for the same redirect, so every branch
    // (including the missing-payment_id back-out) must be guarded exactly once.
    if (handledRef.current) return;
    handledRef.current = true;
    if (!payment_id) {
      router.back();
      return;
    }
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
        <View style={{ flex: 1 }} />
        <FeaturePin
          pinId="tenant-pay-vendor-checkout"
          title="Secure Checkout"
          message="You're paying inside the app through PayFast — no need to leave. Fill in your card or banking details on the secure page. When you finish (or cancel), you'll come straight back to a result screen."
          aiRoute="/(tenant)/ai-chat"
          aiPrompt="What is Pay Vendor and how does checkout work?"
        />
      </View>

      {/* Progress indicator — Review done, Pay is the current step. */}
      <PaymentStepsIndicator current={1} />

      {/* Hosted payment page embedded in-app (Razorpay-style, no browser hop).
          Only render when the initial URL is a genuine PayFast hosted page —
          never an arbitrary https URL from route params. */}
      {isPayFastUrl(url) ? (
        <WebView
          source={{ uri: url }}
          style={{ flex: 1, backgroundColor: '#F5F5F5' }}
          startInLoadingState
          renderLoading={() => (
            <View style={{ flex: 1 }} testID="checkout-loading">
              <LoadingSpinner color="#007A4D" message="Loading secure payment…" />
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
        <View style={{ flex: 1 }} testID="checkout-blocked">
          <ErrorState
            title="Payment link unavailable"
            message={
              url
                ? 'This payment link is not from a trusted provider. Please go back and try again.'
                : 'Payment link is missing. Please go back and try again.'
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}
