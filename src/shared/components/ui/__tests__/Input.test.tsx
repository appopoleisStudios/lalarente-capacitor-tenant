import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Input } from '../Input';

describe('Input', () => {
  it('renders with placeholder', () => {
    const { getByPlaceholderText } = render(<Input placeholder="Enter value" />);
    expect(getByPlaceholderText('Enter value')).toBeTruthy();
  });

  it('renders label when provided', () => {
    const { getByText } = render(<Input label="Email" placeholder="Enter email" />);
    expect(getByText('Email')).toBeTruthy();
  });

  it('renders error message when provided', () => {
    const { getByText } = render(<Input error="Required field" />);
    expect(getByText('Required field')).toBeTruthy();
  });

  it('fires onChangeText when text changes', () => {
    const handler = jest.fn();
    const { getByPlaceholderText } = render(<Input placeholder="Type" onChangeText={handler} />);
    fireEvent.changeText(getByPlaceholderText('Type'), 'new value');
    expect(handler).toHaveBeenCalledWith('new value');
  });
});
