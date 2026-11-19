/**
 * CT7-065: Property Type on Add / Edit Property was a free-text input
 * pre-filled with the raw "apartment". It is now a single-select chip list.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PropertyTypePicker } from '../PropertyTypePicker';

describe('PropertyTypePicker (CT7-065)', () => {
  it('shows every type with a proper label and marks the selected one', () => {
    const { getByText, getByTestId } = render(
      <PropertyTypePicker value="apartment" onChange={jest.fn()} />
    );
    ['Apartment', 'House', 'Townhouse', 'Cottage', 'Room'].forEach((label) => getByText(label));
    expect(getByTestId('property-type-chip-apartment').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(getByTestId('property-type-chip-house').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('stores the lower-case value tenant search filters on', () => {
    const onChange = jest.fn();
    const { getByText } = render(<PropertyTypePicker value="apartment" onChange={onChange} />);
    fireEvent.press(getByText('Townhouse'));
    expect(onChange).toHaveBeenCalledWith('townhouse');
  });

  it('matches a stored value case-insensitively without rewriting it', () => {
    const onChange = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <PropertyTypePicker value="Townhouse" onChange={onChange} />
    );
    expect(getByTestId('property-type-chip-townhouse').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(queryByTestId('property-type-chip-custom')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps an unknown stored value as a selectable chip', () => {
    const onChange = jest.fn();
    const { getByText, getByTestId, rerender } = render(
      <PropertyTypePicker value="garden_flat" onChange={onChange} />
    );
    expect(getByTestId('property-type-chip-custom').props.accessibilityState).toMatchObject({
      selected: true,
    });
    getByText('Garden Flat');

    // Owner picks House, then changes their mind: the old value is still there.
    rerender(<PropertyTypePicker value="house" onChange={onChange} />);
    fireEvent.press(getByText('Garden Flat'));
    expect(onChange).toHaveBeenCalledWith('garden_flat');
  });
});

describe('Add / Edit Property use the picker, not a text input (CT7-065 guard)', () => {
  const fs = jest.requireActual('fs') as typeof import('fs');
  const path = jest.requireActual('path') as typeof import('path');
  const SCREENS = path.resolve(__dirname, '..', '..', 'screens');

  it.each(['AddPropertyScreen.tsx', 'EditPropertyScreen.tsx'])('%s', (file) => {
    const src = fs.readFileSync(path.join(SCREENS, file), 'utf8');
    expect(src).toContain('<PropertyTypePicker');
    expect(src).not.toMatch(/onChangeText=\{[^}]*property_type:/);
  });
});
