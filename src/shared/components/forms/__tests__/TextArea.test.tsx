import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TextArea } from '../TextArea';

describe('TextArea', () => {
  it('renders with default placeholder', () => {
    const { getByPlaceholderText } = render(<TextArea />);
    expect(getByPlaceholderText('Enter text...')).toBeTruthy();
  });

  it('renders with custom placeholder', () => {
    const { getByPlaceholderText } = render(<TextArea placeholder="Describe..." />);
    expect(getByPlaceholderText('Describe...')).toBeTruthy();
  });

  it('fires onChangeText when text changes', () => {
    const handler = jest.fn();
    const { getByPlaceholderText } = render(<TextArea onChangeText={handler} />);
    fireEvent.changeText(getByPlaceholderText('Enter text...'), 'Hello world');
    expect(handler).toHaveBeenCalledWith('Hello world');
  });

  it('shows character count when maxLength is set and showCount is true', () => {
    const { getByText } = render(<TextArea value="Hi" maxLength={100} showCount />);
    expect(getByText('2/100')).toBeTruthy();
  });

  it('does not show character count when maxLength is not set', () => {
    const { queryByText } = render(<TextArea value="Hello" />);
    expect(queryByText(/\d+\//)).toBeNull();
  });

  it('renders error state', () => {
    const { getByText } = render(<TextArea error="This field is required" />);
    expect(getByText('This field is required')).toBeTruthy();
  });
});
