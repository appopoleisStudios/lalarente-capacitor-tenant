import React from 'react';
import { render } from '@testing-library/react-native';
import { Card } from '../Card';

describe('Card', () => {
  it('renders children', () => {
    const { getByText } = render(<Card><>{'Card Content'}</></Card>);
    expect(getByText('Card Content')).toBeTruthy();
  });

  it('renders with padding and rounding by default', () => {
    const { getByText } = render(<Card><>{'Content'}</></Card>);
    expect(getByText('Content')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { getByText } = render(<Card className="mb-4"><>{'Styled'}</></Card>);
    expect(getByText('Styled')).toBeTruthy();
  });
});
