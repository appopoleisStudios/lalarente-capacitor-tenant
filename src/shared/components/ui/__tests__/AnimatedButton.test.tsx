import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AnimatedButton } from '../AnimatedButton';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}), { virtual: true });

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return {
    ...Reanimated,
    useSharedValue: jest.fn(() => ({ value: 1 })),
    useAnimatedStyle: jest.fn(() => ({})),
    withSpring: jest.fn((val) => val),
  };
});

describe('AnimatedButton', () => {
  it('renders children', () => {
    const { getByText } = render(
      <AnimatedButton onPress={jest.fn()}>
        <>{'Press Me'}</>
      </AnimatedButton>
    );
    expect(getByText('Press Me')).toBeTruthy();
  });

  it('fires onPress when pressed', () => {
    const handler = jest.fn();
    const { getByRole } = render(
      <AnimatedButton onPress={handler}>
        <>{'Tap'}</>
      </AnimatedButton>
    );
    fireEvent.press(getByRole('button'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const handler = jest.fn();
    const { getByRole } = render(
      <AnimatedButton onPress={handler} disabled>
        <>{'Tap'}</>
      </AnimatedButton>
    );
    fireEvent.press(getByRole('button'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes accessibilityLabel', () => {
    const { getByLabelText } = render(
      <AnimatedButton onPress={jest.fn()} accessibilityLabel="Close button">
        <>{'X'}</>
      </AnimatedButton>
    );
    expect(getByLabelText('Close button')).toBeTruthy();
  });

  it('sets accessibilityRole to button by default', () => {
    const { getByRole } = render(
      <AnimatedButton onPress={jest.fn()}>
        <>{'OK'}</>
      </AnimatedButton>
    );
    expect(getByRole('button')).toBeTruthy();
  });

  it('allows overriding accessibilityRole', () => {
    const { getByRole } = render(
      <AnimatedButton onPress={jest.fn()} accessibilityRole="link">
        <>{'Link'}</>
      </AnimatedButton>
    );
    expect(getByRole('link')).toBeTruthy();
  });

  it('applies custom styles', () => {
    const { getByRole } = render(
      <AnimatedButton onPress={jest.fn()} style={{ margin: 10 }}>
        <>{'Styled'}</>
      </AnimatedButton>
    );
    const btn = getByRole('button');
    expect(btn).toBeTruthy();
  });
});
