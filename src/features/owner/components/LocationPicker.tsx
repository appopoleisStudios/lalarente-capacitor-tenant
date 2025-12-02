import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

interface LocationPickerProps {
  initialAddress?: string;
  initialLatitude?: number;
  initialLongitude?: number;
  onLocationSelect: (location: {
    address: string;
    city: string;
    province: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  }) => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  initialAddress = '',
  initialLatitude = -26.2041, // Johannesburg default
  initialLongitude = 28.0473,
  onLocationSelect,
}) => {
  const [region, setRegion] = useState({
    latitude: initialLatitude,
    longitude: initialLongitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [markerPosition, setMarkerPosition] = useState({
    latitude: initialLatitude,
    longitude: initialLongitude,
  });
  const [selectedAddress, setSelectedAddress] = useState(initialAddress);
  const mapRef = useRef<MapView>(null);

  const handlePlaceSelect = (data: any, details: any) => {
    if (!details) return;

    const { geometry, address_components, formatted_address } = details;
    const { lat, lng } = geometry.location;

    // Extract address components
    let city = '';
    let province = '';
    let postalCode = '';

    address_components.forEach((component: any) => {
      const types = component.types;
      if (types.includes('locality')) {
        city = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        province = component.long_name;
      } else if (types.includes('postal_code')) {
        postalCode = component.long_name;
      }
    });

    const newRegion = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    setRegion(newRegion);
    setMarkerPosition({ latitude: lat, longitude: lng });
    setSelectedAddress(formatted_address);

    // Animate map to new location
    mapRef.current?.animateToRegion(newRegion, 500);

    // Callback with location data
    onLocationSelect({
      address: formatted_address,
      city,
      province,
      postalCode,
      latitude: lat,
      longitude: lng,
    });
  };

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setMarkerPosition({ latitude, longitude });

    // Reverse geocode to get address
    reverseGeocode(latitude, longitude);
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        const { address_components, formatted_address } = result;

        let city = '';
        let province = '';
        let postalCode = '';

        address_components.forEach((component: any) => {
          const types = component.types;
          if (types.includes('locality')) {
            city = component.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            province = component.long_name;
          } else if (types.includes('postal_code')) {
            postalCode = component.long_name;
          }
        });

        setSelectedAddress(formatted_address);

        onLocationSelect({
          address: formatted_address,
          city,
          province,
          postalCode,
          latitude,
          longitude,
        });
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Property Location</Text>
      <Text style={styles.helperText}>Search for address or tap on map to adjust pin</Text>

      {/* Google Places Autocomplete */}
      <GooglePlacesAutocomplete
        placeholder="Search for address..."
        onPress={handlePlaceSelect}
        query={{
          key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
          language: 'en',
          components: 'country:za', // Restrict to South Africa
        }}
        fetchDetails={true}
        enablePoweredByContainer={false}
        listViewDisplayed={false}
        keepResultsAfterBlur={true}
        styles={{
          container: styles.autocompleteContainer,
          textInput: styles.autocompleteInput,
          listView: styles.autocompleteList,
        }}
        textInputProps={{
          placeholderTextColor: '#9ca3af',
        }}
      />

      {/* Selected Address Display */}
      {selectedAddress ? (
        <View style={styles.selectedAddressContainer}>
          <Text style={styles.selectedAddressLabel}>Selected:</Text>
          <Text style={styles.selectedAddress}>{selectedAddress}</Text>
        </View>
      ) : null}

      {/* Map View */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={region}
          onPress={handleMapPress}
          showsUserLocation={true}
          showsMyLocationButton={true}
        >
          <Marker
            coordinate={markerPosition}
            draggable
            onDragEnd={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              setMarkerPosition({ latitude, longitude });
              reverseGeocode(latitude, longitude);
            }}
          />
        </MapView>
      </View>

      <Text style={styles.mapHint}>
        💡 Drag the pin to adjust the exact location
      </Text>
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
    marginBottom: 8,
  },
  autocompleteContainer: {
    flex: 0,
    zIndex: 1,
  },
  autocompleteInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  autocompleteList: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginTop: 4,
  },
  selectedAddressContainer: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  selectedAddressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803d',
    marginBottom: 4,
  },
  selectedAddress: {
    fontSize: 13,
    color: '#166534',
  },
  mapContainer: {
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  map: {
    flex: 1,
  },
  mapHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
});
