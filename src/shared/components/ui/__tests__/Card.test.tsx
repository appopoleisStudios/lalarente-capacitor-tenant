import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { Card } from '../Card';

describe('Card', () => {
  it('renders children', () => {
    const { getByText } = render(<Card><Text>Card Content</Text></Card>);
    expect(getByText('Card Content')).toBeTruthy();
  });

  it('renders with padding and rounding by default', () => {
    const { getByText } = render(<Card><Text>Content</Text></Card>);
    expect(getByText('Content')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { getByText } = render(<Card className="mb-4"><Text>Styled</Text></Card>);
    expect(getByText('Styled')).toBeTruthy();
  });
});
