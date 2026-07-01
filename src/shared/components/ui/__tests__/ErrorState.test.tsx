import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
  it('renders error message', () => {
    const { getByText } = render(
      <ErrorState message="Something went wrong." />
    );
    expect(getByText('Something went wrong.')).toBeTruthy();
  });

  it('renders retry button when onRetry is provided', () => {
    const handler = jest.fn();
    const { getByText } = render(
      <ErrorState message="Network error." onRetry={handler} />
    );
    expect(getByText('Retry')).toBeTruthy();
    fireEvent.press(getByText('Retry'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is omitted', () => {
    const { queryByText } = render(
      <ErrorState message="Error occurred." />
    );
    expect(queryByText('Retry')).toBeNull();
  });

  it('renders with icon when provided', () => {
    const { getByText } = render(
      <ErrorState message="Error" icon="cloud-offline-outline" />
    );
    expect(getByText('Error')).toBeTruthy();
  });
});
