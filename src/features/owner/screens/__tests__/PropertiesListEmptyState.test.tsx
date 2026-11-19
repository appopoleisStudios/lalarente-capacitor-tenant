/**
 * CT7-058: searching My Properties for something with no match showed "No
 * properties yet — Add your first property" although the owner has properties.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import PropertiesListScreen from '../PropertiesListScreen';
import { useProperties } from '../../../properties/hooks/useProperties';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: {} }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
});
jest.mock('../../../../lib/supabase', () => ({
  supabase: { auth: { getUser: () => Promise.resolve({ data: { user: { id: 'owner-1' } } }) } },
}));
jest.mock('../../../properties/hooks/useProperties', () => ({ useProperties: jest.fn() }));
jest.mock('../../components/PropertyCard', () => {
  const { Text } = require('react-native');
  return {
    PropertyCard: ({ property }: { property: { title: string } }) => <Text>{property.title}</Text>,
  };
});

const PROPS = [
  { id: 'p1', title: '2B Datura', address: '2 Datura Street', city: 'Verulam', status: 'rented' },
  {
    id: 'p2',
    title: 'Dolphin',
    address: '4 Dolphin Crescent',
    city: 'Ballito',
    status: 'available',
  },
];

const hook = (properties: unknown[]) =>
  (useProperties as jest.Mock).mockReturnValue({
    properties,
    loading: false,
    error: null,
    refreshing: false,
    refresh: jest.fn(),
  });

describe('My Properties empty states (CT7-058)', () => {
  it('a search with no match says so and offers to clear it — not "No properties yet"', () => {
    hook(PROPS);
    const ui = render(<PropertiesListScreen />);
    fireEvent.changeText(ui.getByPlaceholderText('Search title, address, city'), 'zzz-no-such');
    expect(ui.getByText('No properties match')).toBeTruthy();
    expect(ui.queryByText('No properties yet')).toBeNull();
    fireEvent.press(ui.getByTestId('owner-properties-clear-filters'));
    expect(ui.getByText('2B Datura')).toBeTruthy();
    expect(ui.getByText('Dolphin')).toBeTruthy();
  });

  it('an owner with no properties still gets "No properties yet" and Add Property', () => {
    hook([]);
    const ui = render(<PropertiesListScreen />);
    expect(ui.getByText('No properties yet')).toBeTruthy();
    // header button + the empty state's own button
    expect(ui.getAllByText('+ Add Property')).toHaveLength(2);
  });
});
