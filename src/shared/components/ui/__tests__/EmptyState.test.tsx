import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and message', () => {
    const { getByText } = render(
      <EmptyState title="No Items" message="There are no items to display." />
    );
    expect(getByText('No Items')).toBeTruthy();
    expect(getByText('There are no items to display.')).toBeTruthy();
  });

  it('renders with icon when provided', () => {
    const { getByText } = render(
      <EmptyState title="Empty" message="Nothing here" icon="folder-open-outline" />
    );
    expect(getByText('Empty')).toBeTruthy();
  });

  it('renders action button when onAction is provided', () => {
    const handler = jest.fn();
    const { getByText } = render(
      <EmptyState
        title="No Results"
        message="Try a different search."
        actionLabel="Refresh"
        onAction={handler}
      />
    );
    expect(getByText('Refresh')).toBeTruthy();
    fireEvent.press(getByText('Refresh'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when onAction is omitted', () => {
    const { queryByText } = render(
      <EmptyState title="No Items" message="Nothing here." />
    );
    expect(queryByText('Refresh')).toBeNull();
  });
});
