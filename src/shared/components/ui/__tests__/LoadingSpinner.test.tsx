import React from 'react';
import { render } from '@testing-library/react-native';
import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders without crashing', () => {
    const tree = render(<LoadingSpinner />).toJSON();
    expect(tree).toBeTruthy();
  });

  it('renders with custom size', () => {
    const tree = render(<LoadingSpinner size="large" />).toJSON();
    expect(tree).toBeTruthy();
  });

  it('renders with custom color', () => {
    const tree = render(<LoadingSpinner color="#FF0000" />).toJSON();
    expect(tree).toBeTruthy();
  });
});
