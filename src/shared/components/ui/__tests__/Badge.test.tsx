import React from 'react';
import { render } from '@testing-library/react-native';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders the label text', () => {
    const { getByText } = render(<Badge label="New" />);
    expect(getByText('New')).toBeTruthy();
  });

  it('renders with success variant by default', () => {
    const { getByText } = render(<Badge label="Success" />);
    expect(getByText('Success')).toBeTruthy();
  });

  it('renders all variants without error', () => {
    const variants = ['success', 'warning', 'error', 'info'] as const;
    for (const variant of variants) {
      const { getByText } = render(<Badge label={variant} variant={variant} />);
      expect(getByText(variant)).toBeTruthy();
    }
  });
});
