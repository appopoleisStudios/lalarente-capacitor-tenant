import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { propertiesApi } from '../api/propertiesApi';
import type { PropertyWithRelations } from '../api/propertiesApi';

// Only render https URLs in the WebView frame. The URL comes from the DB row
// (not route params), but an owner-set value could still be a javascript:/data:
// scheme — a one-line guard keeps the frame from executing arbitrary content.
const isHttpsUrl = (raw: string | null | undefined): boolean => {
  if (!raw) return false;
  try {
    return new URL(raw).protocol === 'https:';
  } catch {
    return false;
  }
};

// Role property tab roots the CTA passes as backTo; close navigates to
// `${backTo}/${id}` so the user lands on the detail, never the Dashboard.
const ALLOWED_BACK_TO = ['/(owner)/properties', '/(tenant)/properties'] as const;

/**
 * Fullscreen 3D tour viewer (Plane #92 Phase 1).
 *
 * The route (properties/[id]/view3d) is registered with href:null in both the
 * owner and tenant layouts; the CTA ("View in 3D") is only rendered on the
 * detail screens when property.media_3d_url is set — so this screen always has
 * a real tour to show and the CTA never lies.
 *
 * Security: the URL comes from the DB row (fetched by id), NOT from route
 * params — a deep link with a forged ?url= cannot make the branded frame
 * render an arbitrary page (mirrors the PayFast checkout allowlist approach).
 */
export default function PropertyView3DScreen() {
  const router = useRouter();
  const { id, backTo } = useLocalSearchParams<{ id: string; backTo?: string }>();
  const [property, setProperty] = useState<PropertyWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await propertiesApi.getProperty(id);
        if (cancelled) return;
        if (!data.media_3d_url || !isHttpsUrl(data.media_3d_url)) {
          setError('No 3D tour is available for this property yet.');
        } else {
          setProperty(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load the 3D tour.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Deterministic return to the property detail screen. The view3d route is a
  // hidden-tab pushed screen — bare router.back() pops past the Properties tab
  // stack to the Dashboard (same hidden-tab bug fixed in #74/#143). The CTA
  // passes backTo ('/(owner)/properties' | '/(tenant)/properties'), so close
  // navigates straight back to the detail; fall back to back() if absent or if
  // a deep link forged a different backTo (app-internal only, but stay honest).
  const handleBack = () => {
    if (
      id &&
      typeof backTo === 'string' &&
      (ALLOWED_BACK_TO as readonly string[]).includes(backTo)
    ) {
      router.navigate(`${backTo}/${id}` as never);
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header — dark chrome, always visible so the user can never be trapped */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="view3d-close"
          onPress={handleBack}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close 3D tour"
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle} testID="view3d-title">
            3D Tour
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {property?.title || 'Immersive walkthrough'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading 3D tour…</Text>
        </View>
      ) : error || !property?.media_3d_url || !isHttpsUrl(property.media_3d_url) ? (
        <View style={styles.center}>
          <Ionicons name="cube-outline" size={56} color="rgba(255,255,255,0.6)" />
          <Text style={styles.errorText}>{error || '3D tour unavailable'}</Text>
          <TouchableOpacity
            testID="view3d-error-back"
            onPress={handleBack}
            style={styles.errorBackButton}
            accessibilityRole="button"
          >
            <Text style={styles.errorBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          source={{ uri: property.media_3d_url }}
          style={styles.webview}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Loading 3D tour…</Text>
            </View>
          )}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          setSupportMultipleWindows={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0B0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111118',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  webview: {
    flex: 1,
    backgroundColor: '#0B0B0F',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  errorBackButton: {
    marginTop: 20,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  errorBackText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B0B0F',
  },
});
