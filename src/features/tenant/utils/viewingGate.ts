// CT7-030 / CT7-032: what a tenant's open viewing allows on a property.
// One open (pending or approved) viewing per tenant per property, and no
// application until that viewing has happened (date passed), been marked
// viewed (completed) or been cancelled/declined.

export interface OpenViewing {
  status: string; // 'pending' | 'approved'
  requested_date: string; // YYYY-MM-DD
  confirmed_date: string | null; // timestamptz once the owner confirms
}

export const OPEN_VIEWING_STATUSES = ['pending', 'approved'] as const;

/** True while the viewing is still ahead of us. */
export function isViewingUpcoming(v: OpenViewing, now: Date = new Date()): boolean {
  if (v.confirmed_date) return new Date(v.confirmed_date).getTime() > now.getTime();
  // Unconfirmed: upcoming until the requested day ends in South Africa
  // (SAST, UTC+2, no DST) — the same rule the database trigger applies.
  const [y, m, d] = v.requested_date.slice(0, 10).split('-').map(Number);
  const endOfRequestedDaySast = Date.UTC(y, m - 1, d + 1) - 2 * 60 * 60 * 1000;
  return endOfRequestedDaySast > now.getTime();
}

export function viewingGate(v: OpenViewing | null, now: Date = new Date()) {
  const open = !!v && (OPEN_VIEWING_STATUSES as readonly string[]).includes(v.status);
  return {
    /** Another request is blocked while one is open. */
    canRequestViewing: !open,
    /** Applying is blocked while the open viewing is still upcoming. */
    canApply: !open || !isViewingUpcoming(v!, now),
    requestLabel: !open
      ? 'Request Viewing'
      : v!.status === 'approved'
        ? 'Viewing Booked'
        : 'Viewing Requested',
  };
}
