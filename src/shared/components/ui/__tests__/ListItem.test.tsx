import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ListItem } from '../ListItem';

describe('ListItem', () => {
  it('renders the title', () => {
    const { getByText } = render(<ListItem title="Item Title" />);
    expect(getByText('Item Title')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    const { getByText } = render(<ListItem title="Title" subtitle="Subtitle" />);
    expect(getByText('Subtitle')).toBeTruthy();
  });

  it('fires onPress when pressed', () => {
    const handler = jest.fn();
    const { getByText } = render(<ListItem title="Tap Me" onPress={handler} />);
    fireEvent.press(getByText('Tap Me'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const handler = jest.fn();
    const { getByText } = render(<ListItem title="Disabled" onPress={handler} disabled />);
    fireEvent.press(getByText('Disabled'));
    expect(handler).not.toHaveBeenCalled();
  });
});
