import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Chip } from '../Chip';

describe('Chip', () => {
  it('renders the label', () => {
    const { getByText } = render(<Chip label="Filter" />);
    expect(getByText('Filter')).toBeTruthy();
  });

  it('fires onPress when pressed', () => {
    const handler = jest.fn();
    const { getByText } = render(<Chip label="Tap" onPress={handler} />);
    fireEvent.press(getByText('Tap'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('renders with selected state', () => {
    const { getByText } = render(<Chip label="Active" selected />);
    expect(getByText('Active')).toBeTruthy();
  });

  it('renders all variants without error', () => {
    const variants = ['default', 'primary', 'outline'] as const;
    for (const variant of variants) {
      const { getByText, unmount } = render(<Chip label={variant} variant={variant} />);
      expect(getByText(variant)).toBeTruthy();
      unmount();
    }
  });
});
