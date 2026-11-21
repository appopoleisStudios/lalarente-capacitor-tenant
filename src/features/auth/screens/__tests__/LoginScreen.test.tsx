/**
 * CT7-028: a failed sign-in shows the plain-words message from signInErrors,
 * not the raw auth error text.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';

const mockSignIn = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }) }));
jest.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({ signIn: mockSignIn, profile: null, loading: false }),
}));
jest.mock('@/src/core/observability/sentry', () => ({ reportApiError: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

it('wrong email or password shows the mapped message, not the raw error (CT7-028)', async () => {
  mockSignIn.mockRejectedValue(
    Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials' })
  );
  const screen = render(<LoginScreen />);
  fireEvent.changeText(screen.getByTestId('email-input'), 'tenant@example.com');
  fireEvent.changeText(screen.getByTestId('password-input'), 'wrong-password');
  fireEvent.press(screen.getByTestId('sign-in-button'));

  await waitFor(() => expect(screen.getByText(/^Incorrect email or password\./)).toBeTruthy());
  expect(mockSignIn).toHaveBeenCalledWith('tenant@example.com', 'wrong-password');
  expect(screen.queryByText('Invalid login credentials')).toBeNull();
});
