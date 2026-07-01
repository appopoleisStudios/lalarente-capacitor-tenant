import React from 'react';
import { render } from '@testing-library/react-native';
import { Toast } from '../Toast';

describe('Toast', () => {
  it('renders nothing when not visible', () => {
    const { queryByText } = render(<Toast message="Hello" visible={false} />);
    expect(queryByText('Hello')).toBeNull();
  });

  it('renders message when visible', () => {
    const { getByText } = render(<Toast message="Saved!" visible={true} />);
    expect(getByText('Saved!')).toBeTruthy();
  });

  it('renders all types without error', () => {
    const types = ['success', 'error', 'info'] as const;
    for (const type of types) {
      const { getByText, unmount } = render(
        <Toast message={type} visible={true} type={type} />
      );
      expect(getByText(type)).toBeTruthy();
      unmount();
    }
  });
});
