import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { ModalSheet } from './ModalSheet';

// Per-user+pin persistence: a dismissed pin never shows again for that user on
// this device. Falls back to an anonymous key if the session isn't ready yet.
const PIN_STORAGE_PREFIX = 'lalarente:feature-pin:dismissed:';
const PIN_STORAGE_ANON = 'anon';

// Stable testIDs so Maestro E2E flows can drive the pin (Plane #90).
export const FEATURE_PIN_TEST_IDS = {
  dismiss: 'feature-pin-dismiss',
  askAi: 'feature-pin-ask-ai',
  message: 'feature-pin-message',
} as const;

export interface FeaturePinProps {
  /** Stable unique id, e.g. 'tenant-payments-hub'. Becomes testID `feature-pin-<pinId>`. */
  pinId: string;
  /** Short sheet title (also used by screen readers). */
  title: string;
  /** 1–2 sentence how-to shown in the sheet. */
  message: string;
  /** Role AI chat route for the "Ask Lala AI" handoff, e.g. '/(tenant)/ai-chat'. */
  aiRoute?: string;
  /** Prefilled prompt sent with the AI handoff. */
  aiPrompt?: string;
  /** Pin glyph size (default 18). The touch target stays 32×32. */
  size?: number;
  /** Override the rendered testID. */
  testID?: string;
  style?: ViewStyle;
}

/**
 * FeaturePin / HelpHotspot primitive (Plane #90).
 *
 * A lightweight note pin anchored next to a title or CTA that teaches the
 * feature in context: a bottom sheet with a 1–2 sentence how-to and an
 * optional "Ask Lala AI" deep-link. Dismiss is persisted per user+pinId via
 * AsyncStorage. Deliberately passive — it never blocks the money path and the
 * sheet can be dismissed without penalty (no 12-step tour).
 */ export function FeaturePin({
  pinId,
  title,
  message,
  aiRoute,
  aiPrompt,
  size = 18,
  testID,
  style,
}: FeaturePinProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<boolean | null>(null); // null = checking storage
  const [showSheet, setShowSheet] = useState(false);
  // Resolved once (local getSession — no network) and cached, so the dismiss
  // path never depends on a remote round-trip.
  const storageKeyRef = useRef<string | null>(null);

  const resolveStorageKey = useCallback(async () => {
    if (storageKeyRef.current) return storageKeyRef.current;
    // getSession() reads the locally-cached session (no network call), unlike
    // getUser() which re-validates against the server — a hang there would
    // block dismissal.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? PIN_STORAGE_ANON;
    storageKeyRef.current = `${PIN_STORAGE_PREFIX}${userId}:${pinId}`;
    return storageKeyRef.current;
  }, [pinId]);

  // Load dismissal state once on mount. While unknown (null) the pin stays
  // hidden to avoid flashing on already-dismissed pins.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const key = await resolveStorageKey();
        const stored = await AsyncStorage.getItem(key);
        if (active) setDismissed(stored === '1');
      } catch {
        if (active) setDismissed(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [resolveStorageKey]);

  const handleDismiss = useCallback(() => {
    // Close the sheet first — never gate the UI on storage I/O. The ModalSheet
    // stays MOUNTED (controlled via `visible`) so RN can complete the native
    // dismiss animation; unmounting a visible <Modal> leaves it stuck on iOS.
    setShowSheet(false);
    setDismissed(true);
    // Persist best-effort in the background.
    (async () => {
      try {
        const key = await resolveStorageKey();
        await AsyncStorage.setItem(key, '1');
      } catch {
        // Non-fatal: the pin is already dismissed for this session.
      }
    })();
  }, [resolveStorageKey]);

  // Only the pin button is hidden once dismissed. The ModalSheet itself stays
  // mounted (visible={showSheet}) so its dismissal animation completes — see
  // handleDismiss. While the storage check runs (dismissed === null) nothing
  // renders, so an already-dismissed pin never flashes.
  const showPin = dismissed === false;

  const pinTestID = testID ?? `feature-pin-${pinId}`;
  const showAiHandoff = Boolean(aiRoute && aiPrompt);

  return (
    <>
      {showPin && (
        <TouchableOpacity
          testID={pinTestID}
          accessibilityRole="button"
          accessibilityLabel={`Help: ${title}`}
          accessibilityHint={message}
          onPress={() => setShowSheet(true)}
          style={[styles.pinButton, style]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="help-circle-outline" size={size} color="#737373" />
        </TouchableOpacity>
      )}

      <ModalSheet visible={showSheet} onClose={() => setShowSheet(false)} title={title}>
        <Text style={styles.message} testID={FEATURE_PIN_TEST_IDS.message}>
          {message}
        </Text>

        <View style={styles.actions}>
          {showAiHandoff && (
            <TouchableOpacity
              testID={FEATURE_PIN_TEST_IDS.askAi}
              style={[styles.button, styles.aiButton]}
              onPress={() => {
                setShowSheet(false);
                // Object form keeps the typed Href pattern; the params add the
                // prefilled prompt for the AI screen (pathname is a caller-provided
                // route string, so the whole object is cast like the dashboard's
                // dynamic route pushes).
                router.push({ pathname: aiRoute, params: { prompt: aiPrompt } } as Href);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={16} color="#7C3AED" />
              <Text style={styles.aiButtonText}>Ask Lala AI</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            testID={FEATURE_PIN_TEST_IDS.dismiss}
            style={[styles.button, styles.gotItButton]}
            onPress={handleDismiss}
            activeOpacity={0.8}
          >
            <Text style={styles.gotItText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </ModalSheet>
    </>
  );
}

const styles = StyleSheet.create({
  pinButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  message: {
    fontSize: 14,
    color: '#525252',
    lineHeight: 20,
    marginBottom: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
  },
  aiButton: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  aiButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C3AED',
  },
  gotItButton: {
    backgroundColor: '#002395',
  },
  gotItText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
