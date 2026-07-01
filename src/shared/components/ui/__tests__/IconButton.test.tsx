import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { IconButton } from '../IconButton';

describe('IconButton', () => {
  it('fires onPress when pressed', () => {
    const handler = jest.fn();
    const { getByRole } = render(
      <IconButton name="close" onPress={handler} accessibilityLabel="Close" />
    );
    fireEvent.press(getByRole('button'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('passes accessibilityLabel', () => {
    const { getByLabelText } = render(
      <IconButton name="menu" onPress={jest.fn()} accessibilityLabel="Menu" />
    );
    expect(getByLabelText('Menu')).toBeTruthy();
  });

  it('renders with size prop', () => {
    const { getByRole } = render(
      <IconButton name="search" onPress={jest.fn()} size={32} accessibilityLabel="Search" />
    );
    expect(getByRole('button')).toBeTruthy();
  });

  it('renders with color prop', () => {
    const { getByRole } = render(
      <IconButton name="heart" onPress={jest.fn()} color="#FF0000" accessibilityLabel="Favorite" />
    );
    expect(getByRole('button')).toBeTruthy();
  });
});
