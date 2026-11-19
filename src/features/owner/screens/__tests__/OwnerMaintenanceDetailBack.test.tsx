/**
 * CT7-055: the request detail's back arrow pushed the maintenance list when
 * there was history, adding an entry, so the next Android Back reopened the
 * same request (device: detail → ← → list → Back → detail again). It now goes
 * back like Android Back, and to the list only when there is no history.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import OwnerMaintenanceDetailScreen from '../OwnerMaintenanceDetailScreen';
import { getMaintenanceRequestById } from '@/src/features/maintenance/api';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    canGoBack: jest.fn(),
  },
  useLocalSearchParams: () => ({ id: 'req-1' }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, []),
}));
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner-1' } }) }));
jest.mock('@/src/core/observability/sentry', () => ({ reportApiError: jest.fn() }));
jest.mock('@/src/features/maintenance/api', () => ({
  getMaintenanceRequestById: jest.fn(),
  getQuotesByRequest: jest.fn().mockResolvedValue([]),
  getQuoteRevisions: jest.fn().mockResolvedValue([]),
  getPOByRequestId: jest.fn().mockResolvedValue(null),
  getProgressUpdates: jest.fn().mockResolvedValue([]),
  getClosureReport: jest.fn().mockResolvedValue(null),
  maintenanceApi: new Proxy({}, { get: () => jest.fn().mockResolvedValue(null) }),
}));
jest.mock('@/src/features/maintenance/components/MediaGallery', () => ({
  MediaGallery: () => null,
}));
jest.mock('@/src/features/owner/components', () => ({
  QuoteCard: () => null,
  RequestInfoSection: () => null,
  RequestPOSection: () => null,
  RequestTimelineSection: () => null,
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const REQUEST = {
  id: 'req-1',
  title: 'Leaking tap',
  description: 'Kitchen tap drips',
  status: 'open',
  priority: 'medium',
  category: 'plumbing',
  created_at: '2026-11-18T10:00:00Z',
  images: [],
  property: { id: 'p1', title: '2B Datura', address: '2 Datura Street' },
  tenant: null,
};

async function pressBack() {
  (getMaintenanceRequestById as jest.Mock).mockResolvedValue(REQUEST);
  const ui = render(<OwnerMaintenanceDetailScreen />);
  await waitFor(() => expect(ui.getByTestId('owner-maintenance-detail-back')).toBeTruthy());
  fireEvent.press(ui.getByTestId('owner-maintenance-detail-back'));
}

describe('owner request detail back arrow (CT7-055)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('goes back (no new history entry) when there is somewhere to go back to', async () => {
    (router.canGoBack as jest.Mock).mockReturnValue(true);
    await pressBack();
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens the maintenance list when there is no history (opened from a link)', async () => {
    (router.canGoBack as jest.Mock).mockReturnValue(false);
    await pressBack();
    expect(router.replace).toHaveBeenCalledWith('/(owner)/maintenance');
    expect(router.back).not.toHaveBeenCalled();
  });
});
