/**
 * CT7-055: the request detail's back arrow pushed the maintenance list when
 * there was history, adding an entry, so the next Android Back reopened the
 * same request (device: detail → ← → list → Back → detail again). It now goes
 * back like Android Back; with no history it resets the tabs to the list
 * (useGoBackOr, whose router-backed test covers the history itself).
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
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
jest.mock('@react-navigation/native', () => ({ useNavigation: jest.fn() }));
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

const nav = { canGoBack: jest.fn(), goBack: jest.fn(), reset: jest.fn() };

async function pressBack() {
  (useNavigation as jest.Mock).mockReturnValue(nav);
  (getMaintenanceRequestById as jest.Mock).mockResolvedValue(REQUEST);
  const ui = render(<OwnerMaintenanceDetailScreen />);
  await waitFor(() => expect(ui.getByTestId('owner-maintenance-detail-back')).toBeTruthy());
  fireEvent.press(ui.getByTestId('owner-maintenance-detail-back'));
}

describe('owner request detail back arrow (CT7-055)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('goes back (no new history entry) when there is somewhere to go back to', async () => {
    nav.canGoBack.mockReturnValue(true);
    await pressBack();
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(nav.reset).not.toHaveBeenCalled();
  });

  it('opened cold from a link: resets the tabs to the maintenance list', async () => {
    nav.canGoBack.mockReturnValue(false);
    await pressBack();
    expect(nav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'maintenance' }] });
    expect(nav.goBack).not.toHaveBeenCalled();
  });
});
