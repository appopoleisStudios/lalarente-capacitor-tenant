import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signedSignatureUrl } from '@/src/shared/utils/storageDataUri';
import { colors } from '@/src/shared/theme/colors';

const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * One signature line on the owner's and tenant's lease screens. Shared so the
 * two screens can't drift apart again (the tenant copy lost `flex: 1` and
 * pushed "Signed <date>" off the screen).
 */
export default function LeaseSignatureRow({
  label,
  name,
  signedAt,
  signatureUrl,
  accentColor,
}: {
  label: string;
  name: string;
  signedAt: string | null;
  signatureUrl?: string | null;
  accentColor: string;
}) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  // Bumped when the image fails to load (e.g. the signed URL expired while
  // the screen stayed open) so a fresh URL is signed — at most twice.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    signedSignatureUrl(signatureUrl, SIGNED_URL_TTL_SECONDS)
      // An unsigned (public) URL can't load from the private bucket — show nothing.
      .then((uri) => live && setImageUri(uri && uri !== signatureUrl ? uri : null))
      .catch(() => live && setImageUri(null));
    return () => {
      live = false;
    };
  }, [signatureUrl, attempt]);

  return (
    <View style={styles.row}>
      <View testID={`lease-signature-left-${label.toLowerCase()}`} style={styles.left}>
        <Ionicons
          name={signedAt ? 'checkmark-circle' : 'time-outline'}
          size={20}
          color={signedAt ? accentColor : colors.warning[600]}
        />
        <View style={styles.text}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
              onError={() => setAttempt((n) => (n < 2 ? n + 1 : n))}
            />
          )}
        </View>
      </View>
      <Text
        testID={`lease-signature-status-${label.toLowerCase()}`}
        style={[styles.status, signedAt && { color: accentColor }]}
      >
        {signedAt ? `Signed ${new Date(signedAt).toLocaleDateString()}` : 'Pending'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  text: { flex: 1 },
  label: { fontSize: 12, color: colors.gray[500] },
  name: { fontSize: 16, fontWeight: '600', color: colors.gray[800] },
  status: { fontSize: 14, color: colors.warning[600], flexShrink: 0 },
  image: {
    width: 120,
    height: 60,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 4,
    backgroundColor: colors.gray[50],
  },
});
