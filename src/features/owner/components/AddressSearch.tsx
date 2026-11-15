import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import Constants from 'expo-constants';
import { colors } from '@/src/shared/theme/colors';

export interface AddressSelection {
  address: string;
  city: string;
  province: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}

/**
 * Pulls street / city / province / postal code out of a Google Place.
 * Street is "<number> <route>" when Google has it, else the formatted address.
 */
export function parsePlace(details: any): AddressSelection | null {
  if (!details?.geometry?.location) return null;
  const parts: Record<string, string> = {};
  for (const c of details.address_components ?? []) {
    for (const t of c.types ?? []) parts[t] = parts[t] ?? c.long_name;
  }
  const street = [parts.street_number, parts.route].filter(Boolean).join(' ');
  return {
    address: street || details.formatted_address || '',
    city: parts.locality || parts.sublocality || parts.administrative_area_level_2 || '',
    province: parts.administrative_area_level_1 || '',
    postalCode: parts.postal_code || '',
    latitude: details.geometry.location.lat,
    longitude: details.geometry.location.lng,
  };
}

/**
 * Google Places address search without a map. The map-based LocationPicker
 * was removed from Add Property (react-native-maps white screen, 97786bb),
 * which took the search with it (CT7-027).
 */
export function AddressSearch({
  onSelect,
  onFocus,
}: {
  onSelect: (a: AddressSelection) => void;
  /** Lets the screen scroll the search to the top so suggestions aren't
   *  hidden behind the keyboard. */
  onFocus?: () => void;
}) {
  return (
    <View style={styles.container} testID="address-search">
      <Text style={styles.label}>Search address</Text>
      <GooglePlacesAutocomplete
        placeholder="Start typing the street address…"
        fetchDetails
        // Wait for a pause in typing: without it, responses to earlier
        // keystrokes could land last and show stale suggestions.
        debounce={350}
        minLength={3}
        onPress={(_data, details) => {
          const parsed = parsePlace(details);
          if (parsed) onSelect(parsed);
        }}
        query={{
          key: Constants.expoConfig?.extra?.googleMapsApiKey || '',
          language: 'en',
          components: 'country:za',
        }}
        enablePoweredByContainer={false}
        keyboardShouldPersistTaps="handled"
        disableScroll
        textInputProps={{
          testID: 'address-search-input',
          onFocus,
          placeholderTextColor: colors.text.tertiary,
        }}
        styles={{
          textInput: styles.input,
          row: styles.row,
          listView: styles.list,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16, zIndex: 10 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text.primary, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 16,
    color: colors.text.primary,
  },
  row: { paddingVertical: 12 },
  list: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 12,
    backgroundColor: colors.background.default,
  },
});
