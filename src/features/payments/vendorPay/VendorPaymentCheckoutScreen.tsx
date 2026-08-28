import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { PaymentStepsIndicator } from '@/src/shared/components/ui/PaymentStepsIndicator';
import { ErrorState, FeaturePin, LoadingSpinner } from '@/src/shared/components';
import type { VendorPayConfig } from './vendorPayConfig';

const REDIRECT_BASE =
  'https://vvepwaolnkzfzhzgxlwr.supabase.co/functions/v1/vendor-payment-redirect';

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

export function VendorPaymentCheckoutScreen({ config }: { config: VendorPayConfig }) {
  const router = useRouter();
  const { payment_id, url } = useLocalSearchParams<{
    payment_id: string;
    url: string;
  }>();
  const handledRef = useRef(false);

  const goToResult = () => {
    if (handledRef.current) return;
    handledRef.current = true;
    if (!payment_id) {
      router.back();
      return;
    }
    router.replace(`${config.resultPath}?payment_id=${payment_id}` as any);
  };

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
          pinId={config.checkoutPinId}
          title={config.checkoutPinTitle}
          message={config.checkoutPinMessage}
          aiRoute={config.aiRoute as any}
          aiPrompt={config.checkoutAiPrompt}
        />
      </View>

      <PaymentStepsIndicator current={1} />

      {isPayFastUrl(url) ? (
        <WebView
          source={{ uri: url }}
          style={{ flex: 1, backgroundColor: '#F5F5F5' }}
          startInLoadingState
          renderLoading={() => (
            <View style={{ flex: 1 }} testID="checkout-loading">
              <LoadingSpinner color={config.accent} message="Loading secure payment…" />
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
