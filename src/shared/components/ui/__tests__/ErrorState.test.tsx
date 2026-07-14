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
    expect(getByText('Try Again')).toBeTruthy();
    fireEvent.press(getByText('Try Again'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is omitted', () => {
    const { queryByText } = render(
      <ErrorState message="Error occurred." />
    );
    expect(queryByText('Try Again')).toBeNull();
  });

  it('renders with title when provided', () => {
    const { getByText } = render(
      <ErrorState title="Error" message="Network issue" />
    );
    expect(getByText('Error')).toBeTruthy();
  });
});
