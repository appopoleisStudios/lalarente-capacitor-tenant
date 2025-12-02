import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';

/**
 * Simple Location Picker (Fallback)
 * Use this if you haven't set up Google Maps yet
 * Replace LocationPicker import with this in AddPropertyScreen.tsx
 */

interface SimpleLocationPickerProps {
  initialAddress?: string;
  onLocationSelect: (location: {
    address: string;
    city: string;
    province: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  }) => void;
}

export const SimpleLocationPicker: React.FC<SimpleLocationPickerProps> = ({
  initialAddress = '',
  onLocationSelect,
}) => {
  const [address, setAddress] = React.useState(initialAddress);
  const [city, setCity] = React.useState('');
  const [province, setProvince] = React.useState('');
  const [postalCode, setPostalCode] = React.useState('');

  const handleChange = () => {
    onLocationSelect({
      address,
      city,
      province,
      postalCode,
      latitude: -26.2041, // Default Johannesburg coordinates
      longitude: 28.0473,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Property Location</Text>
      <Text style={styles.helperText}>
        📍 Manual entry (Google Maps integration available - see SETUP_LOCATION_FEATURE.md)
      </Text>

      <View style={styles.section}>
        <Text style={styles.fieldLabel}>Address *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., 123 Main Street"
          placeholderTextColor="#9ca3af"
          value={address}
          onChangeText={(text) => {
            setAddress(text);
            handleChange();
          }}
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.section, { flex: 1 }]}>
          <Text style={styles.fieldLabel}>City *</Text>
          <TextInput
            style={styles.input}
            placeholder="Johannesburg"
            placeholderTextColor="#9ca3af"
            value={city}
            onChangeText={(text) => {
              setCity(text);
              handleChange();
            }}
          />
        </View>
        <View style={[styles.section, { flex: 1 }]}>
          <Text style={styles.fieldLabel}>Province *</Text>
          <TextInput
            style={styles.input}
            placeholder="Gauteng"
            placeholderTextColor="#9ca3af"
            value={province}
            onChangeText={(text) => {
              setProvince(text);
              handleChange();
            }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.fieldLabel}>Postal Code</Text>
        <TextInput
          style={styles.input}
          placeholder="2000"
          placeholderTextColor="#9ca3af"
          value={postalCode}
          keyboardType="numeric"
          onChangeText={(text) => {
            setPostalCode(text);
            handleChange();
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 8,
  },
  section: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
});
