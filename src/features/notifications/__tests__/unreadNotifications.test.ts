/**
 * CT7-064: only a tapped notification is marked read. Opening the
 * Notifications screen must not mark everything read (it used to, so every
 * notification vanished after one visit).
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  linkNotifications,
  markNotificationsRead,
  notificationRoute,
  type UnreadNotification,
} from '../utils/unreadNotifications';

const mockCalls: { method: string; args: unknown[] }[] = [];
const mockChain: any = new Proxy(
  {},
  {
    get: (_t, method: string) => {
      if (method === 'then') return undefined;
      return (...args: unknown[]) => {
        mockCalls.push({ method, args });
        return mockChain;
      };
    },
  }
);
jest.mock('@/src/lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockChain.from(...a) },
}));

const notif = (over: Partial<UnreadNotification>): UnreadNotification => ({
  id: 'n1',
  type: 'lease_signed',
  title: 'Lease Signed',
  body: '',
  data: {},
  created_at: '2026-11-19T10:00:00Z',
  ...over,
});

describe('markNotificationsRead', () => {
  beforeEach(() => (mockCalls.length = 0));

  it('marks only the given ids, never every notification of the user', async () => {
    await markNotificationsRead(['a', 'b']);
    expect(mockCalls.find((c) => c.method === 'update')).toBeTruthy();
    expect(mockCalls).toContainEqual({ method: 'in', args: ['id', ['a', 'b']] });
    expect(mockCalls.some((c) => c.method === 'eq' && c.args[0] === 'user_id')).toBe(false);
  });

  it('does nothing for an empty list', async () => {
    await markNotificationsRead([]);
    expect(mockCalls).toHaveLength(0);
  });
});

describe('linkNotifications', () => {
  it('attaches duplicates to their row and returns the rest', () => {
    const items: { id: string; notificationIds?: string[] }[] = [{ id: 'viewing-v1' }];
    const rest = linkNotifications(
      items,
      [notif({ id: 'n1', data: { viewingId: 'v1' } }), notif({ id: 'n2' })],
      (n) => (n.data?.viewingId ? `viewing-${n.data.viewingId}` : null)
    );
    expect(items[0].notificationIds).toEqual(['n1']);
    expect(rest.map((n) => n.id)).toEqual(['n2']);
  });
});

describe('notificationRoute', () => {
  it('opens the thing the notification is about', () => {
    expect(
      notificationRoute('tenant', notif({ type: 'viewing_approved', data: { viewingId: 'v1' } }))
    ).toBe('/(tenant)/viewings/v1');
    expect(
      notificationRoute('owner', notif({ type: 'maintenance_updated', data: { request_id: 'r1' } }))
    ).toBe('/(owner)/maintenance/r1');
    expect(
      notificationRoute(
        'vendor',
        notif({ type: 'maintenance_updated', data: { request_id: 'r1' } })
      )
    ).toBe('/(vendor)/jobs/r1');
    expect(
      notificationRoute('tenant', notif({ type: 'payment_due', data: { application_id: 'a1' } }))
    ).toBe('/(tenant)/holding-deposit');
    expect(notificationRoute('vendor', notif({ type: 'lease_signed' }))).toBeNull();
  });
});

describe('Notifications screens (guard)', () => {
  const screens = [
    'owner/screens/OwnerNotificationsScreen.tsx',
    'tenant/screens/TenantNotificationsScreen.tsx',
    'vendor/screens/VendorNotificationsScreen.tsx',
  ];

  it.each(screens)('%s marks nothing read on open, only through markNotificationsRead', (rel) => {
    const src = fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');
    // No direct read_at writes (the old open-marks-all code), no mark-all.
    expect(src).not.toMatch(/update\(\s*\{\s*read_at/);
    expect(src).not.toMatch(/markAllAsRead/);
    // Marking happens in the tap handler only.
    const tap = src.slice(src.indexOf('const handleTap'));
    expect(tap).toMatch(/markNotificationsRead\(item\.notificationIds\)/);
    expect(src.slice(0, src.indexOf('const handleTap'))).not.toMatch(/markNotificationsRead\(/);
  });
});
