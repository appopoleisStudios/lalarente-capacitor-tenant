import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from '../Text';

describe('Text (shared)', () => {
  it('renders children', () => {
    const { getByText } = render(<Text>{'Hello World'}</Text>);
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('renders all variants without error', () => {
    const variants = ['heading', 'subheading', 'body', 'caption'] as const;
    for (const variant of variants) {
      const { getByText, unmount } = render(<Text variant={variant}>{variant}</Text>);
      expect(getByText(variant)).toBeTruthy();
      unmount();
    }
  });
});
