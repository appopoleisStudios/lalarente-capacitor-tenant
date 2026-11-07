// Lease-signing gate (CT7-012). Pure logic, no UI — exported so screen
// renderers stay thin and the gate can be unit-tested in isolation.
//
// Shares the same checkTenantProfileCompleteness() view that the
// dashboard "Complete Your Profile" banner (CT7-013) reads from. Sharing
// rules does not guarantee the two reads observe the same row at the
// same instant — but it does guarantee the field requirements can't
// drift between surfaces.

import { supabase } from '@/src/lib/supabase';
import { checkTenantProfileCompleteness } from './profileCompleteness';

export type SignLeaseGateDecision =
  | { action: 'sign' }
  | {
      action: 'alert';
      title: string;
      message: string;
      cta?: { label: string; href: string };
    };

export async function evaluateSignLeaseGate(): Promise<SignLeaseGateDecision> {
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

  // Fail CLOSED on lookup error — we can't confirm the profile is
  // complete, so we won't open the signature modal. User retries.
  if (result.status === 'error') {
    return {
      action: 'alert',
      title: "Couldn't verify your profile",
      message: `We couldn't load your profile just now. Please try again.\n\n${result.message}`,
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
}
