// Lease-signing gate (CT7-012). UI-independent orchestration function:
// resolves the authenticated user, reads the shared profile completeness
// view, and returns a decision the screen renders as either a signature
// modal or an Alert.
//
// Shares the same checkTenantProfileCompleteness() rules the dashboard
// "Complete Your Profile" banner (CT7-013) reads from. Sharing rules
// does not guarantee the two reads observe the same row at the same
// instant — but it does guarantee the field requirements can't drift
// between surfaces.

import { supabase } from '@/src/lib/supabase';
import { checkTenantProfileCompleteness } from './profileCompleteness';
import { reportApiError } from '@/src/core/observability/sentry';

export type SignLeaseGateDecision =
  | { action: 'sign' }
  | {
      action: 'alert';
      title: string;
      message: string;
      cta?: { label: string; href: string };
    };

/** Alert the user sees when either the auth read or the profile lookup
 *  REJECTS (throws) rather than returning a value. We never want a raw
 *  promise rejection to bubble out of handleSignLease and leave the user
 *  with no feedback. Keeps the signature modal closed (fail-closed). */
const UNEXPECTED_ERROR_DECISION: SignLeaseGateDecision = {
  action: 'alert',
  title: "Couldn't verify your profile",
  message: "We couldn't check your profile just now. Please check your connection and try again.",
};

export async function evaluateSignLeaseGate(): Promise<SignLeaseGateDecision> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        action: 'alert',
        title: 'Not signed in',
        message: 'Please sign in again to continue.',
      };
    }

    const result = await checkTenantProfileCompleteness(user.id);

    // Fail CLOSED on reported lookup error — we can't confirm the
    // profile is complete, so we won't open the signature modal.
    if (result.status === 'error') {
      return {
        action: 'alert',
        title: "Couldn't verify your profile",
        message:
          "We couldn't load your profile just now. Please check your connection and try again.",
      };
    }

    if (!result.complete) {
      return {
        action: 'alert',
        title: 'Complete your profile first',
        message: `Complete these profile details before signing your lease:\n\n• ${result.missing.join('\n• ')}`,
        cta: { label: 'Go to Profile', href: '/(tenant)/profile' },
      };
    }

    return { action: 'sign' };
  } catch (err) {
    // Rejected promises (network errors from auth.getUser, unexpected
    // throws in the completeness helper, etc.) land here. We never want
    // a raw rejection to bubble into the React event handler.
    reportApiError(err, 'profiles', 'select');
    console.error('[leaseSignGate] evaluate failed', err);
    return UNEXPECTED_ERROR_DECISION;
  }
}
