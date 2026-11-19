/**
 * CT7-056: the owner dashboard's Recent Activity rows (and "View All") were
 * buttons with no onPress — they animated on tap and went nowhere.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ActivitySection } from '../ActivitySection';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const ACTIVITIES = [
  {
    icon: '🔧',
    label: 'New Maintenance',
    value: '2B Datura',
    date: '1h ago',
    route: '/(owner)/maintenance/req-1',
  },
  {
    icon: '❌',
    label: 'Viewing Cancelled',
    value: 'Nashin · 2B Datura',
    date: '2h ago',
    route: '/(owner)/viewings/v-1',
  },
];

describe('owner Recent Activity (CT7-056)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('each row opens its record', () => {
    const ui = render(<ActivitySection activities={ACTIVITIES} />);
    fireEvent.press(ui.getByTestId('owner-activity-0'));
    expect(router.push).toHaveBeenLastCalledWith('/(owner)/maintenance/req-1');
    fireEvent.press(ui.getByTestId('owner-activity-1'));
    expect(router.push).toHaveBeenLastCalledWith('/(owner)/viewings/v-1');
  });

  it('has no dead "View All" button', () => {
    const ui = render(<ActivitySection activities={ACTIVITIES} />);
    expect(ui.queryByText('View All')).toBeNull();
  });
});
