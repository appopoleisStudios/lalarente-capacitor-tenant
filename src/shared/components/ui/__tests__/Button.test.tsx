import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('renders children text', () => {
    const { getByText } = render(<Button onPress={jest.fn()}>{'Click Me'}</Button>);
    expect(getByText('Click Me')).toBeTruthy();
  });

  it('fires onPress when pressed', () => {
    const handler = jest.fn();
    const { getByText } = render(<Button onPress={handler}>{'Press'}</Button>);
    fireEvent.press(getByText('Press'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const handler = jest.fn();
    const { getByText } = render(<Button onPress={handler} disabled>{'Press'}</Button>);
    fireEvent.press(getByText('Press'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('shows loading indicator when loading', () => {
    const { queryByText } = render(<Button onPress={jest.fn()} loading>{'Submit'}</Button>);
    expect(queryByText('Submit')).toBeNull();
  });

  it('renders all variants without error', () => {
    const variants = ['primary', 'secondary', 'outline', 'ghost'] as const;
    for (const variant of variants) {
      const { getByText, unmount } = render(
        <Button onPress={jest.fn()} variant={variant}>{variant}</Button>
      );
      expect(getByText(variant)).toBeTruthy();
      unmount();
    }
  });

  it('renders all sizes without error', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const { getByText, unmount } = render(
        <Button onPress={jest.fn()} size={size}>{size}</Button>
      );
      expect(getByText(size)).toBeTruthy();
      unmount();
    }
  });

  it('passes accessibility props', () => {
    const { getByRole } = render(
      <Button onPress={jest.fn()} accessibilityLabel="Submit form" accessibilityHint="Submits the current form">
        {'Submit'}
      </Button>
    );
    const btn = getByRole('button');
    expect(btn.props.accessibilityLabel).toBe('Submit form');
    expect(btn.props.accessibilityHint).toBe('Submits the current form');
  });
});
