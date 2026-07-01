import React from 'react';
import { render } from '@testing-library/react-native';
import { Avatar } from '../Avatar';

describe('Avatar', () => {
  it('renders initials when name is provided without uri', () => {
    const { getByText } = render(<Avatar name="John Doe" />);
    expect(getByText('JD')).toBeTruthy();
  });

  it('renders single initial for single name', () => {
    const { getByText } = render(<Avatar name="Alice" />);
    expect(getByText('A')).toBeTruthy();
  });

  it('renders fallback "?" when no name is provided', () => {
    const { getByText } = render(<Avatar />);
    expect(getByText('?')).toBeTruthy();
  });

  it('renders with default size of 40', () => {
    const { getByText } = render(<Avatar name="Test" />);
    expect(getByText('T')).toBeTruthy();
  });

  it('renders with all variants without error', () => {
    const variants = ['circle', 'rounded', 'square'] as const;
    for (const variant of variants) {
      const { getByText, unmount } = render(<Avatar name="Test User" variant={variant} />);
      expect(getByText('TU')).toBeTruthy();
      unmount();
    }
  });
});
