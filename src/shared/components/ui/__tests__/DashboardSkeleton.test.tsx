/** CT7-026: the dashboard shows its layout immediately while data loads. */
import React from 'react';
import { render } from '@testing-library/react-native';
import { DashboardSkeleton } from '../DashboardSkeleton';

it('renders the real title and placeholder blocks, not a blank spinner', () => {
  const { getByText, getByTestId } = render(<DashboardSkeleton title="Portfolio Dashboard" />);
  expect(getByText('Portfolio Dashboard')).toBeTruthy();
  expect(getByTestId('dashboard-skeleton')).toBeTruthy();
});
