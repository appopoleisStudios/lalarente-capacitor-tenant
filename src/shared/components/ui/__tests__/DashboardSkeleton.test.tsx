/** CT7-026: the dashboard shows its layout immediately while data loads. */
import React from 'react';
import { render } from '@testing-library/react-native';
import { DashboardSkeleton } from '../DashboardSkeleton';

it('renders the real title and placeholder blocks, not a blank spinner', () => {
  const { getByText, getByTestId } = render(<DashboardSkeleton title="Portfolio Dashboard" />);
  expect(getByText('Portfolio Dashboard')).toBeTruthy();
  expect(getByTestId('dashboard-skeleton')).toBeTruthy();
});

it('is announced to screen readers as a busy progress indicator', () => {
  const { getByTestId } = render(<DashboardSkeleton title="Welcome back," variant="tenant" />);
  const el = getByTestId('dashboard-skeleton');
  expect(el.props.accessibilityRole).toBe('progressbar');
  expect(el.props.accessibilityState).toEqual({ busy: true });
});
