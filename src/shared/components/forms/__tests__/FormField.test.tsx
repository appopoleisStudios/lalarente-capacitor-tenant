import React from 'react';
import { render } from '@testing-library/react-native';
import { FormField } from '../FormField';
import { TextInput } from 'react-native';

describe('FormField', () => {
  it('renders label when provided', () => {
    const { getByText } = render(
      <FormField label="Email">
        <TextInput placeholder="Enter email" />
      </FormField>
    );
    expect(getByText('Email')).toBeTruthy();
  });

  it('renders error message when provided', () => {
    const { getByText } = render(
      <FormField label="Email" error="Required">
        <TextInput placeholder="Enter email" />
      </FormField>
    );
    expect(getByText('Required')).toBeTruthy();
  });

  it('renders hint text when provided', () => {
    const { getByText } = render(
      <FormField label="Password" hint="Min 8 characters">
        <TextInput placeholder="Enter password" />
      </FormField>
    );
    expect(getByText('Min 8 characters')).toBeTruthy();
  });

  it('renders children', () => {
    const { getByPlaceholderText } = render(
      <FormField label="Name">
        <TextInput placeholder="Enter name" />
      </FormField>
    );
    expect(getByPlaceholderText('Enter name')).toBeTruthy();
  });
});
