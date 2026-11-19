import { supabase } from '@/src/lib/supabase';

/**
 * CT7-064: a notification is read when the user taps it — never because the
 * Notifications screen was opened. The screens list unread rows and mark only
 * the tapped one(s) read, so untapped notifications stay (and keep the bell
 * count) until the user acts on them.
 */

export type UnreadNotification = {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  data: Record<string, any> | null;
  created_at: string;
};

export type NotificationRole = 'owner' | 'tenant' | 'vendor';

export async function fetchUnreadNotifications(
  userId: string,
  limit = 50
): Promise<UnreadNotification[]> {
  const { data } = await (supabase as any)
    .from('notifications')
    .select('id, type, title, body, data, created_at')
    .eq('user_id', userId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as UnreadNotification[];
}

/** Mark exactly these notifications read (the ones behind the tapped item). */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await (supabase as any)
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .is('read_at', null);
}

/**
 * Attach each notification to the on-screen item it duplicates (keyFor returns
 * that item's id, or null). Returns the notifications no item covers — the
 * screen lists those as their own rows.
 */
export function linkNotifications<T extends { id: string; notificationIds?: string[] }>(
  items: T[],
  notifications: UnreadNotification[],
  keyFor: (n: UnreadNotification) => string | null
): UnreadNotification[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const unlinked: UnreadNotification[] = [];
  notifications.forEach((n) => {
    const key = keyFor(n);
    const item = key ? byId.get(key) : undefined;
    if (item) {
      item.notificationIds = [...(item.notificationIds ?? []), n.id];
    } else {
      unlinked.push(n);
    }
  });
  return unlinked;
}

/** Where tapping a stand-alone notification takes the user (null: nowhere). */
export function notificationRoute(role: NotificationRole, n: UnreadNotification): string | null {
  const d = n.data ?? {};
  const viewingId = d.viewingId ?? d.viewing_id;
  const requestId = d.request_id ?? d.requestId;
  if (n.type.startsWith('viewing_') && viewingId) {
    return role === 'vendor' ? null : `/(${role})/viewings/${viewingId}`;
  }
  if (n.type.startsWith('maintenance_') && requestId) {
    return role === 'vendor'
      ? `/(vendor)/jobs/${requestId}`
      : `/(${role})/maintenance/${requestId}`;
  }
  if (role === 'owner') {
    if (n.type.startsWith('application_')) return '/(owner)/applications';
    if (n.type.startsWith('lease_')) {
      return d.lease_id ? `/(owner)/leases/${d.lease_id}` : '/(owner)/tenants';
    }
    return null;
  }
  if (role === 'tenant') {
    if (n.type.startsWith('application_')) return '/(tenant)/application-status';
    if (n.type.startsWith('lease_')) return '/(tenant)/lease';
    if (n.type.startsWith('payment_')) {
      return d.application_id ? '/(tenant)/holding-deposit' : '/(tenant)/payments';
    }
  }
  return null;
}
