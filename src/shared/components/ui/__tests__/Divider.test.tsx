import React from 'react';
import { render } from '@testing-library/react-native';
import { Divider } from '../Divider';

describe('Divider', () => {
  it('renders without crashing', () => {
    const tree = render(<Divider />).toJSON();
    expect(tree).toBeTruthy();
  });

  it('renders with custom color', () => {
    const tree = render(<Divider color="#FF0000" />).toJSON();
    expect(tree).toBeTruthy();
  });

  it('renders with custom spacing', () => {
    const tree = render(<Divider spacing={20} />).toJSON();
    expect(tree).toBeTruthy();
  });
});
