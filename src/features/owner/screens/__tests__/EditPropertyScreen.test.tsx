/**
 * Edit Property, rendered with the real screen.
 * CT7-010: back / cancel always went to the Properties tab, skipping the
 * Property Detail the owner came from. It must go back when it can and use
 * the Properties tab only when there is no history.
 * CT7-009: the remove-photo × was 24×24 and hung half off the thumbnail.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import EditPropertyScreen from '../EditPropertyScreen';
import { propertiesApi } from '../../../properties/api/propertiesApi';
import { removeControls } from './removePhotoControl';

const mockRouter = { back: jest.fn(), canGoBack: jest.fn(), navigate: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: 'prop-1' }),
}));
jest.mock('../../../properties/api/propertiesApi', () => ({
  propertiesApi: { getProperty: jest.fn() },
}));
jest.mock('../../components/LocationPicker', () => ({ LocationPicker: () => null }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
jest.mock('@react-native-community/datetimepicker', () => () => null);

const REMOVE = 'owner-edit-property-photo-remove';

async function renderLoaded() {
  const screen = render(<EditPropertyScreen />);
  await waitFor(() => expect(screen.getByText('Edit Property')).toBeTruthy());
  return screen;
}

beforeEach(() => {
  jest.clearAllMocks();
  (propertiesApi.getProperty as jest.Mock).mockResolvedValue({
    title: 'Sea View',
    address: '2 Datura Street',
    city: 'Verulam',
    province: 'KwaZulu-Natal',
    images: ['https://x/a.jpg', 'https://x/b.jpg'],
  });
});

describe('Edit Property back arrow (CT7-010)', () => {
  it('returns to the screen the owner came from', async () => {
    mockRouter.canGoBack.mockReturnValue(true);
    fireEvent.press((await renderLoaded()).getByText('←'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('opened cold (no history): goes to the Properties tab', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    fireEvent.press((await renderLoaded()).getByText('←'));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/(owner)/properties');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});

it('remove-photo × is at least 32 px, inside the photo, and removes it (CT7-009)', async () => {
  const screen = await renderLoaded();
  expect(removeControls(screen, REMOVE)).toHaveLength(2);
  for (const c of removeControls(screen, REMOVE)) {
    expect(c.size.width).toBeGreaterThanOrEqual(32);
    expect(c.size.height).toBeGreaterThanOrEqual(32);
    expect(c.position.top).toBeGreaterThanOrEqual(0);
    expect(c.position.right).toBeGreaterThanOrEqual(0);
  }
  fireEvent.press(removeControls(screen, REMOVE)[0].button);
  expect(removeControls(screen, REMOVE)).toHaveLength(1);
});
