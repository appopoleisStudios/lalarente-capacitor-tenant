/**
 * Consent Management Screen
 *
 * Allows users to view and manage their POPIA consent preferences.
 * POPIA s11(2)(b): Data subject may withdraw consent at any time.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useSegments, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';
import { supabase } from '@/src/lib/supabase';
import {
  consentApi,
  OPTIONAL_CONSENTS,
  type ConsentRecord,
  type ConsentType,
} from '../api';

export default function ConsentManagementScreen() {
  const router = useRouter();
  const segments = useSegments();
  const isOwner = segments[0] === '(owner)';
  const dataRightsPath = isOwner ? '/(owner)/privacy/data-rights' : '/(tenant)/privacy/data-rights';
  const profilePath = isOwner ? '/(owner)/profile' : '/(tenant)/profile';
  const [userId, setUserId] = useState<string | null>(null);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<ConsentType | null>(null);

  useEffect(() => {
    initUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userId) fetchConsents();
    }, [userId])
  );

  const initUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      fetchConsentsForUser(user.id);
    }
  };

  const fetchConsents = () => {
    if (userId) fetchConsentsForUser(userId);
  };

  const fetchConsentsForUser = async (uid: string) => {
    try {
      setLoading(true);
      const data = await consentApi.getActiveConsents(uid);
      setConsents(data);
    } catch (err) {
      console.error('Error fetching consents:', err);
    } finally {
      setLoading(false);
    }
  };

  const isConsentActive = (type: ConsentType): boolean => {
    return consents.some((c) => c.consent_type === type && c.status === 'active');
  };

  const handleToggle = async (type: ConsentType, currentlyActive: boolean) => {
    if (!userId) return;
    setToggling(type);

    try {
      if (currentlyActive) {
        // Confirm withdrawal
        Alert.alert(
          'Withdraw Consent',
          'Are you sure you want to withdraw this consent? This may affect certain features.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setToggling(null) },
            {
              text: 'Withdraw',
              style: 'destructive',
              onPress: async () => {
                await consentApi.withdrawConsent(userId, type);
                await fetchConsentsForUser(userId);
                setToggling(null);
              },
            },
          ]
        );
      } else {
        const consentDef = OPTIONAL_CONSENTS.find((c) => c.type === type);
        if (!consentDef) return;

        await consentApi.captureConsent(userId, {
          consentType: type,
          captureMethod: 'settings_toggle',
          consentText: consentDef.text,
        });
        await fetchConsentsForUser(userId);
        setToggling(null);
      }
    } catch (err) {
      console.error('Error toggling consent:', err);
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate(profilePath as never)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy & Consent</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark" size={20} color={colors.primary[500]} />
          <Text style={styles.infoText}>
            Your data is protected under the Protection of Personal Information Act (POPIA).
            You can manage your consent preferences below.
          </Text>
        </View>

        {/* Required Consent (always active, cannot be toggled) */}
        <Text style={styles.sectionTitle}>Required</Text>
        <View style={styles.card}>
          <View style={styles.consentItem}>
            <View style={styles.consentInfo}>
              <Text style={styles.consentLabel}>Data Processing</Text>
              <Text style={styles.consentDesc}>
                Required to use the app. Cannot be withdrawn while your account is active.
              </Text>
            </View>
            <View style={styles.activeChip}>
              <Text style={styles.activeChipText}>Active</Text>
            </View>
          </View>
        </View>

        {/* Optional Consents */}
        <Text style={styles.sectionTitle}>Optional</Text>
        <View style={styles.card}>
          {OPTIONAL_CONSENTS.map((consent, index) => {
            const active = isConsentActive(consent.type);
            return (
              <View
                key={consent.type}
                style={[
                  styles.consentItem,
                  index < OPTIONAL_CONSENTS.length - 1 && styles.consentItemBorder,
                ]}
              >
                <View style={styles.consentInfo}>
                  <Text style={styles.consentLabel}>
                    {consent.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                  <Text style={styles.consentDesc}>{consent.description}</Text>
                </View>
                {toggling === consent.type ? (
                  <ActivityIndicator size="small" color={colors.primary[500]} />
                ) : (
                  <Switch
                    value={active}
                    onValueChange={() => handleToggle(consent.type, active)}
                    trackColor={{ false: colors.gray[200], true: colors.primary[200] }}
                    thumbColor={active ? colors.primary[500] : colors.gray[400]}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Your Rights</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.actionItem, styles.consentItemBorder]}
            onPress={() => router.navigate(dataRightsPath as never)}
          >
            <Ionicons name="download-outline" size={22} color={colors.info[500]} />
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabel}>Request My Data</Text>
              <Text style={styles.actionDesc}>Download all personal data we hold about you</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionItem, styles.consentItemBorder]}
            onPress={() => router.navigate(dataRightsPath as never)}
          >
            <Ionicons name="create-outline" size={22} color={colors.warning[500]} />
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabel}>Correct My Data</Text>
              <Text style={styles.actionDesc}>Request correction of inaccurate information</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.navigate(dataRightsPath as never)}
          >
            <Ionicons name="trash-outline" size={22} color={colors.error[500]} />
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabel}>Delete My Data</Text>
              <Text style={styles.actionDesc}>Request deletion of your personal information</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
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
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary[50],
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.primary[700],
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  consentItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  consentInfo: {
    flex: 1,
    marginRight: 12,
  },
  consentLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  consentDesc: {
    fontSize: 12,
    color: colors.text.tertiary,
    lineHeight: 16,
  },
  activeChip: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[500],
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
});
