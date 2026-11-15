/** CT7-027: Google Place details → Add Property fields. */
jest.mock('react-native-google-places-autocomplete', () => ({
  GooglePlacesAutocomplete: () => null,
}));
jest.mock('expo-constants', () => ({ expoConfig: { extra: {} } }));

import { parsePlace } from '../AddressSearch';

const place = {
  formatted_address: '2 Datura St, Verulam, 4339, South Africa',
  geometry: { location: { lat: -29.64, lng: 31.05 } },
  address_components: [
    { long_name: '2', types: ['street_number'] },
    { long_name: 'Datura Street', types: ['route'] },
    { long_name: 'Verulam', types: ['locality', 'political'] },
    { long_name: 'KwaZulu-Natal', types: ['administrative_area_level_1', 'political'] },
    { long_name: '4339', types: ['postal_code'] },
  ],
};

it('fills street, city, province, postal code and coordinates', () => {
  expect(parsePlace(place)).toEqual({
    address: '2 Datura Street',
    city: 'Verulam',
    province: 'KwaZulu-Natal',
    postalCode: '4339',
    latitude: -29.64,
    longitude: 31.05,
  });
});

it('falls back to the formatted address when there is no street number', () => {
  const p = { ...place, address_components: place.address_components.slice(2) };
  expect(parsePlace(p)?.address).toBe('2 Datura St, Verulam, 4339, South Africa');
});

it('ignores a selection without details', () => {
  expect(parsePlace(null)).toBeNull();
});
