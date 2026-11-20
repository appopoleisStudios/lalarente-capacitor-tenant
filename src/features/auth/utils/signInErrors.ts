// CT7-028: tell the user what went wrong at sign-in, in plain words.
// Wrong email and wrong password deliberately share one message: saying
// "no account with this email" would let anyone find out who uses the app
// (account enumeration — a privacy/security risk under POPIA).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Field-level check before calling the server; null when the email looks valid. */
export function emailFormatError(email: string): string | null {
  const e = email.trim();
  if (!e) return 'Email is required';
  if (!EMAIL_RE.test(e)) return 'Enter a valid email address, e.g. name@example.com';
  return null;
}

/** Maps a sign-in failure (Supabase auth error, network error, timeout) to a message. */
export function signInErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : String((error as any)?.message ?? error ?? '');
  const code = String((error as any)?.code ?? '');
  const m = raw.toLowerCase();

  if (code === 'invalid_credentials' || m.includes('invalid login credentials')) {
    return 'Incorrect email or password. Check both and try again — passwords are case-sensitive.';
  }
  if (code === 'email_not_confirmed' || m.includes('email not confirmed')) {
    return 'Your email address is not confirmed yet. Open the confirmation link we emailed you, then sign in.';
  }
  if (code === 'over_request_rate_limit' || m.includes('rate limit') || m.includes('too many')) {
    return 'Too many sign-in attempts. Please wait a few minutes and try again.';
  }
  // A banned-account message could confirm the email exists even with a wrong
  // password, so it gets a neutral message (SA review).
  if (code === 'user_banned' || m.includes('banned')) {
    return 'Sign-in is not possible for this account. Please contact support.';
  }
  // CT7-067: password accepted, but the session could not be attached.
  if (code === 'session_not_attached') {
    return "Couldn't finish signing in. Check your internet connection and try again.";
  }
  if (code === 'profile_not_loaded') {
    return "Couldn't load your account. Check your internet connection and try again.";
  }
  if (
    m.includes('timed out') ||
    m.includes('network') ||
    m.includes('fetch') ||
    m.includes('offline')
  ) {
    return "Can't reach Lalarente right now. Check your internet connection and try again.";
  }
  return 'Sign-in failed. Please try again.';
}
