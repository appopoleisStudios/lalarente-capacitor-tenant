import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SectionHeader } from '../SectionHeader';

describe('SectionHeader', () => {
  it('renders the title', () => {
    const { getByText } = render(<SectionHeader title="Recent Items" />);
    expect(getByText('Recent Items')).toBeTruthy();
  });

  it('renders action button when actionLabel is provided', () => {
    const handler = jest.fn();
    const { getByText } = render(
      <SectionHeader title="Properties" actionLabel="See All" onAction={handler} />
    );
    expect(getByText('See All')).toBeTruthy();
    fireEvent.press(getByText('See All'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when onAction is omitted', () => {
    const { queryByText } = render(<SectionHeader title="Title" />);
    expect(queryByText('See All')).toBeNull();
  });
});
