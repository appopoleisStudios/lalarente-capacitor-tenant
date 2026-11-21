/** CT7-026: the dashboard shows its layout immediately while data loads. */
import React from 'react';
import { render } from '@testing-library/react-native';
import { DashboardSkeleton } from '../DashboardSkeleton';

it('renders the real title and placeholder blocks, not a blank spinner', () => {
  const { getByText, getByTestId } = render(<DashboardSkeleton title="Portfolio Dashboard" />);
  expect(getByText('Portfolio Dashboard')).toBeTruthy();
  expect(getByTestId('dashboard-skeleton')).toBeTruthy();
});

// CT7-026: both dashboards showed a full-screen "Loading dashboard…" spinner
// after sign-in; their loading branch must render the skeleton instead.
describe.each([
  [
    'owner',
    'src/features/owner/screens/OwnerDashboardScreen.tsx',
    'loading',
    'Portfolio Dashboard',
  ],
  ['tenant', 'src/features/tenant/screens/TenantDashboardScreen.tsx', 'isLoading', 'Welcome back,'],
])('%s dashboard loading state (CT7-026)', (_, rel, flag, title) => {
  const fs = jest.requireActual('fs') as typeof import('fs');
  const path = jest.requireActual('path') as typeof import('path');
  const src = fs
    .readFileSync(path.resolve(__dirname, '..', '..', '..', '..', '..', rel), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('renders DashboardSkeleton while loading', () => {
    const branch = src.match(
      new RegExp(`if \\(${flag}\\) \\{\\s*return \\(([\\s\\S]*?)\\);\\s*\\}`)
    );
    expect(branch).not.toBeNull();
    expect(branch![1]).toMatch(new RegExp(`<DashboardSkeleton title="${title}"`));
    expect(branch![1]).not.toMatch(/ActivityIndicator/);
  });

  it('has no "Loading dashboard" spinner text', () => {
    expect(src).not.toMatch(/Loading dashboard/);
  });
});

it('is announced to screen readers as a busy progress indicator', () => {
  const { getByTestId } = render(<DashboardSkeleton title="Welcome back," variant="tenant" />);
  const el = getByTestId('dashboard-skeleton');
  expect(el.props.accessibilityRole).toBe('progressbar');
  expect(el.props.accessibilityState).toEqual({ busy: true });
});
