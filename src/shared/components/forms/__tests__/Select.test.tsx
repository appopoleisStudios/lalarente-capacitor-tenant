import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Select } from '../Select';

const options = [
  { value: 'opt1', label: 'Option 1' },
  { value: 'opt2', label: 'Option 2' },
  { value: 'opt3', label: 'Option 3' },
];

describe('Select', () => {
  it('renders with placeholder when no value selected', () => {
    const { getByText } = render(
      <Select options={options} value={null} onSelect={jest.fn()} />
    );
    expect(getByText('Select...')).toBeTruthy();
  });

  it('renders selected option label', () => {
    const { getByText } = render(
      <Select options={options} value="opt2" onSelect={jest.fn()} />
    );
    expect(getByText('Option 2')).toBeTruthy();
  });

  it('renders with custom placeholder', () => {
    const { getByText } = render(
      <Select options={options} value={null} onSelect={jest.fn()} placeholder="Choose..." />
    );
    expect(getByText('Choose...')).toBeTruthy();
  });

  it('does not fire onSelect when trigger is pressed (opens modal)', () => {
    const handler = jest.fn();
    const { getByText } = render(
      <Select options={options} value={null} onSelect={handler} />
    );
    fireEvent.press(getByText('Select...'));
    expect(handler).not.toHaveBeenCalled();
  });
});
