import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SearchBar } from '../SearchBar';

describe('SearchBar', () => {
  it('renders with default placeholder', () => {
    const { getByPlaceholderText } = render(<SearchBar value="" onChangeText={jest.fn()} />);
    expect(getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('renders with custom placeholder', () => {
    const { getByPlaceholderText } = render(<SearchBar value="" onChangeText={jest.fn()} placeholder="Find..." />);
    expect(getByPlaceholderText('Find...')).toBeTruthy();
  });

  it('fires onChangeText when text changes', () => {
    const handler = jest.fn();
    const { getByPlaceholderText } = render(<SearchBar value="" onChangeText={handler} />);
    fireEvent.changeText(getByPlaceholderText('Search...'), 'hello');
    expect(handler).toHaveBeenCalledWith('hello');
  });

  it('renders with value prop', () => {
    const { getByPlaceholderText } = render(<SearchBar value="test" onChangeText={jest.fn()} />);
    fireEvent.changeText(getByPlaceholderText('Search...'), 'new');
    expect(getByPlaceholderText('Search...')).toBeTruthy();
  });
});
