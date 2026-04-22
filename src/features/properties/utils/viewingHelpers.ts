/**
 * Viewing Request Helper Functions
 * Handles expiration logic and action status for viewing requests
 */

export interface ViewingRequest {
  id: string;
  status: string;
  requested_date: string;
  requested_time: string;
  [key: string]: any;
}

export interface ViewingActionStatus {
  canApprove: boolean;
  canDecline: boolean;
  canCancel: boolean;
  message: string | null;
  badge: 'Expired' | 'Urgent' | 'Completed' | null;
  badgeColor: string;
  reason?: string;
}

/**
 * Check if a viewing request has expired
 *
 * A viewing is considered expired if:
 * 1. The viewing date/time has passed, OR
 * 2. Status is pending AND owner had at least 24h to respond (created_at > 24h ago)
 *    AND viewing is less than 2h away
 *
 * This prevents newly created viewings from being instantly expired just because
 * they're scheduled within the next 24 hours.
 *
 * @param viewing - The viewing request object
 * @returns true if expired, false otherwise
 */
export function isViewingExpired(viewing: ViewingRequest): boolean {
  const now = new Date();

  // Parse viewing date/time
  const viewingDateTime = new Date(`${viewing.requested_date}T${viewing.requested_time}`);

  // Check if viewing date/time has passed
  if (viewingDateTime < now) {
    return true;
  }

  // For pending viewings: only expire if the owner had 24h to respond
  // AND the viewing is less than 2 hours away
  if (viewing.status === 'pending' && viewing.created_at) {
    const createdAt = new Date(viewing.created_at);
    const ownerHad24h = (now.getTime() - createdAt.getTime()) >= 24 * 60 * 60 * 1000;
    const lessThan2hAway = (viewingDateTime.getTime() - now.getTime()) < 2 * 60 * 60 * 1000;

    if (ownerHad24h && lessThan2hAway) {
      return true;
    }
  }

  return false;
}

/**
 * Check if an approved viewing should be marked as completed
 *
 * @param viewing - The viewing request object
 * @returns true if viewing date has passed, false otherwise
 */
export function shouldBeCompleted(viewing: ViewingRequest): boolean {
  if (viewing.status !== 'approved') {
    return false;
  }

  const now = new Date();
  const viewingDateTime = new Date(`${viewing.requested_date}T${viewing.requested_time}`);

  return viewingDateTime < now;
}

/**
 * Get the number of hours until the viewing
 *
 * @param viewing - The viewing request object
 * @returns Number of hours (can be negative if past)
 */
export function getHoursUntilViewing(viewing: ViewingRequest): number {
  const now = new Date();
  const viewingDateTime = new Date(`${viewing.requested_date}T${viewing.requested_time}`);

  return (viewingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
}

/**
 * Get the action status for a viewing request
 * Determines what actions can be taken and what messages to show
 *
 * @param viewing - The viewing request object
 * @returns ViewingActionStatus object with action permissions and UI hints
 */
export function getViewingActionStatus(viewing: ViewingRequest): ViewingActionStatus {
  const now = new Date();
  const viewingDateTime = new Date(`${viewing.requested_date}T${viewing.requested_time}`);
  const hoursUntil = getHoursUntilViewing(viewing);

  // Check if already expired in database
  if (viewing.status === 'expired') {
    return {
      canApprove: false,
      canDecline: false,
      canCancel: false,
      message: 'This viewing request has expired',
      badge: 'Expired',
      badgeColor: '#6B7280',
      reason: 'marked_as_expired',
    };
  }

  // Check if already completed
  if (viewing.status === 'completed') {
    return {
      canApprove: false,
      canDecline: false,
      canCancel: false,
      message: 'This viewing has been completed',
      badge: 'Completed',
      badgeColor: '#007A4D',
    };
  }

  // Check if viewing date/time has passed
  if (viewingDateTime < now) {
    const reason = viewing.status === 'pending'
      ? 'viewing_date_passed_no_response'
      : 'viewing_date_passed';

    return {
      canApprove: false,
      canDecline: false,
      canCancel: false,
      message: 'This viewing request has expired - the requested date has passed',
      badge: 'Expired',
      badgeColor: '#6B7280',
      reason,
    };
  }

  // Check if pending viewing should be expired:
  // Owner had 24h to respond AND viewing is less than 2h away
  if (viewing.status === 'pending' && viewing.created_at) {
    const createdAt = new Date(viewing.created_at);
    const ownerHad24h = (now.getTime() - createdAt.getTime()) >= 24 * 60 * 60 * 1000;
    const lessThan2hAway = hoursUntil < 2;

    if (ownerHad24h && lessThan2hAway) {
      return {
        canApprove: false,
        canDecline: false,
        canCancel: false,
        message: 'This viewing request has expired - response deadline has passed',
        badge: 'Expired',
        badgeColor: '#FFB81C',
        reason: 'response_deadline_missed',
      };
    }
  }

  // Urgent: Less than 4 hours remain and still pending
  if (hoursUntil < 4 && hoursUntil > 0 && viewing.status === 'pending') {
    return {
      canApprove: true,
      canDecline: true,
      canCancel: false,
      message: `Urgent: Less than ${Math.ceil(hoursUntil)} hours until viewing! Please respond.`,
      badge: 'Urgent',
      badgeColor: '#DE3831',
    };
  }

  // Approved viewing
  if (viewing.status === 'approved') {
    return {
      canApprove: false,
      canDecline: false,
      canCancel: true,
      message: null,
      badge: null,
      badgeColor: '#007A4D',
    };
  }

  // Declined viewing
  if (viewing.status === 'declined') {
    return {
      canApprove: false,
      canDecline: false,
      canCancel: false,
      message: 'This viewing request was declined',
      badge: null,
      badgeColor: '#DE3831',
    };
  }

  // Cancelled viewing
  if (viewing.status === 'cancelled') {
    return {
      canApprove: false,
      canDecline: false,
      canCancel: false,
      message: 'This viewing request was cancelled',
      badge: null,
      badgeColor: '#6B7280',
    };
  }

  // Normal pending state - can approve or decline
  return {
    canApprove: true,
    canDecline: true,
    canCancel: false,
    message: null,
    badge: null,
    badgeColor: '#FFB81C',
  };
}

/**
 * Format viewing date/time for display
 *
 * @param date - Date string (YYYY-MM-DD)
 * @param time - Time string (HH:MM)
 * @returns Formatted string like "25 Jan 2026 at 14:00"
 */
export function formatViewingDateTime(date: string, time: string): string {
  const viewingDate = new Date(`${date}T${time}`);

  return viewingDate.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + ` at ${time}`;
}

/**
 * Get expiry reason in human-readable format
 *
 * @param reason - Expiry reason code
 * @returns Human-readable message
 */
export function getExpiryReasonMessage(reason?: string): string {
  switch (reason) {
    case 'viewing_date_passed':
      return 'The viewing date has passed';
    case 'viewing_date_passed_no_response':
      return 'The viewing date passed without a response from the owner';
    case 'response_deadline_missed':
      return 'The 24-hour response deadline was not met';
    case 'marked_as_expired':
      return 'This request was automatically expired by the system';
    default:
      return 'This viewing request has expired';
  }
}

/**
 * Filter viewings by status
 * Useful for separating active/expired viewings in lists
 *
 * @param viewings - Array of viewing requests
 * @returns Object with active and expired arrays
 */
export function filterViewingsByStatus(viewings: ViewingRequest[]) {
  const active: ViewingRequest[] = [];
  const expired: ViewingRequest[] = [];
  const completed: ViewingRequest[] = [];

  viewings.forEach(viewing => {
    if (viewing.status === 'expired' || isViewingExpired(viewing)) {
      expired.push(viewing);
    } else if (viewing.status === 'completed' || shouldBeCompleted(viewing)) {
      completed.push(viewing);
    } else {
      active.push(viewing);
    }
  });

  return { active, expired, completed };
}
