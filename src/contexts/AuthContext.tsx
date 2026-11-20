import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Database } from '@/src/types/database.types';
import { supabase, clearLocalSession } from '@/src/lib/supabase';
import { clearPendingVendorSelection } from '@/src/features/maintenance/api/vendors/pendingVendorSelection';
import { clearDashboardCaches } from '@/src/shared/utils/dashboardCache';
import {
  registerDevicePush,
  unregisterDevicePush,
} from '@/src/features/notifications/registerPush';

type Profile = Database['public']['Tables']['profiles']['Row'];

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: 'owner' | 'tenant' | 'vendor',
    businessName?: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// CT7-067: supabase.auth.setSession() checks the token over the network and,
// if that fails, RESOLVES with { error } and stores no session. Sign-in used to
// fire it and forget it (a `.catch` never sees a resolved error), so the app
// could look signed in while every query ran without a session: RLS returned
// nothing and the tenant saw "Welcome back, Tenant" with no home.
// Now sign-in/sign-up publish the user only after the session is stored and
// the profile loaded; otherwise they fail and leave no half-signed-in state.
export const ATTACH_SESSION_ATTEMPTS = 2;

export class SessionAttachError extends Error {
  code = 'session_not_attached';
  constructor() {
    super("Couldn't finish signing in");
    this.name = 'SessionAttachError';
  }
}

export class ProfileLoadError extends Error {
  code = 'profile_not_loaded';
  constructor() {
    super("Couldn't load your account");
    this.name = 'ProfileLoadError';
  }
}

/**
 * Store the session in supabase-js and confirm it is this user's. No time
 * limit of its own on purpose: an abandoned setSession could still finish
 * later and sign someone in. It always settles: its network call is bounded
 * by the client's fetch timeout (CT7-068) and storage writes go to memory
 * first (src/lib/supabase.ts).
 */
async function attachSession(
  tokens: { access_token: string; refresh_token: string },
  userId: string
): Promise<Session | null> {
  for (let i = 0; i < ATTACH_SESSION_ATTEMPTS; i++) {
    try {
      const { error } = await supabase.auth.setSession(tokens);
      if (!error) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user?.id === userId) return data.session;
      }
    } catch {
      // try again
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // True while signIn()/signUp() runs. The auth listener ignores every event
  // meanwhile (the stale-session SIGNED_OUT that used to bounce the user back
  // to login, and the SIGNED_IN that setSession emits before the session is
  // verified, CT7-067); signIn()/signUp() publish the outcome themselves.
  const authBusyRef = useRef(false);
  // User whose profile is already loaded/loading — avoids refetching (and
  // re-rendering the dashboard) on every SIGNED_IN / TOKEN_REFRESHED event.
  const profileUserIdRef = useRef<string | null>(null);

  // Fetch user profile from database — uses REST API directly (not supabase-js)
  // to avoid SDK hangs from SecureStore/keychain contention on simulator/device.
  // IMPORTANT: pass the session access_token to authenticate the REST call;
  // otherwise RLS policies (auth.uid() = id) will reject the query.
  const fetchProfile = async (userId: string, accessToken?: string): Promise<Profile | null> => {
    try {
      const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || '';
      const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || '';
      const bearer = accessToken || SUPABASE_ANON_KEY;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.error('Profile fetch HTTP error:', res.status);
        return null;
      }

      const rows = await res.json();
      return (rows?.[0] as Profile) || null;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.warn('Profile fetch timed out after 10s');
      } else {
        console.error('Error fetching profile:', error);
      }
      return null;
    }
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Race getSession against a 5s timeout — stale AsyncStorage tokens can
        // cause the Supabase client to hang indefinitely waiting for a server
        // refresh response, leaving loading=true forever after a new APK install.
        const timeout = new Promise<{ data: { session: null }; error: null }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null }, error: null }), 5000)
        );
        const {
          data: { session },
        } = await Promise.race([supabase.auth.getSession(), timeout]);

        if (session) {
          const nowSecs = Date.now() / 1000;
          const isExpired = (session.expires_at ?? 0) < nowSecs;
          if (isExpired) {
            // Try to refresh — if the refresh token is still valid, great.
            const { data: refreshed } = await supabase.auth.refreshSession();
            if (!refreshed.session) {
              // Refresh token also expired: clear the stale cache locally.
              await supabase.auth.signOut({ scope: 'local' });
              return;
            }
            // Refreshed successfully — use the new session.
            setSession(refreshed.session);
            setUser(refreshed.session.user);
            profileUserIdRef.current = refreshed.session.user.id;
            fetchProfile(refreshed.session.user.id, refreshed.session.access_token).then(
              setProfile
            );
            return;
          }
        }

        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          profileUserIdRef.current = session.user.id;
          fetchProfile(session.user.id, session.access_token).then(setProfile);
        }
      } catch {
        // Any unexpected error: fail safe to login screen.
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (authBusyRef.current) return;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Fire-and-forget profile fetch — supabase-js SDK can hang on ANY
        // database call when SecureStore is contending (not just signIn),
        // so we must NOT block the auth state handler with an await.
        // Pass the session access_token so the REST call is authenticated.
        if (profileUserIdRef.current !== session.user.id) {
          profileUserIdRef.current = session.user.id;
          fetchProfile(session.user.id, session.access_token)
            .then((p) => {
              if (!p) profileUserIdRef.current = null; // let the next event retry
              setProfile(p);
            })
            .catch(() => {
              profileUserIdRef.current = null;
            });
        }
        void import('@/src/features/notifications/registerPush')
          .then(({ registerDevicePush }) => registerDevicePush(session.user.id))
          .catch(() => {});
      } else {
        clearPendingVendorSelection();
        profileUserIdRef.current = null;
        setProfile(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * CT7-067: attach the session, load the profile, then publish all three
   * together. Any failure clears the local session and throws, so the app is
   * never signed in without a working session.
   */
  async function completeSignIn(tokens: {
    access_token: string;
    refresh_token: string;
    user: { id: string };
    [k: string]: unknown;
  }) {
    const userId = tokens.user.id;
    let failure: Error | null = null;
    let loaded: Profile | null = null;
    // the session as supabase-js stored it (it may have refreshed it already)
    const stored = await attachSession(tokens, userId);
    if (!stored) {
      failure = new SessionAttachError();
    } else {
      loaded = await fetchProfile(userId, stored.access_token);
      if (!loaded) failure = new ProfileLoadError();
    }
    if (failure) {
      await clearLocalSession(); // no network: works offline too
      profileUserIdRef.current = null;
      setSession(null);
      setUser(null);
      setProfile(null);
      throw failure;
    }
    profileUserIdRef.current = userId;
    setSession(stored);
    setUser(stored!.user);
    setProfile(loaded);
    // the listener (which registers on SIGNED_IN) is muted during sign-in
    Promise.resolve()
      .then(() => registerDevicePush(userId))
      .catch(() => {});
  }

  // Sign up function — calls register-user edge function to bypass email confirmation
  async function signUp(
    email: string,
    password: string,
    fullName: string,
    role: 'owner' | 'tenant' | 'vendor',
    businessName?: string
  ) {
    if (authBusyRef.current) return;
    try {
      setLoading(true);
      authBusyRef.current = true;

      const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || '';
      const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || '';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/register-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email, password, fullName, role, businessName }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Registration failed');
      }

      const data = await res.json();

      // CT7-067: the account exists now; publish the user only once the
      // session is attached and the profile loaded.
      try {
        await completeSignIn({ ...data.session, user: data.user });
      } catch (e: any) {
        const err = new Error(
          'Your account was created, but we could not sign you in. Please sign in.'
        );
        (err as any).code = e?.code;
        throw err;
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      const wrapped = new Error(error.message || 'Failed to create account');
      (wrapped as any).code = error.code;
      throw wrapped;
    } finally {
      authBusyRef.current = false;
      setLoading(false);
    }
  }

  // Sign in function — uses REST API directly instead of supabase-js SDK
  // because supabase.auth.signInWithPassword() can hang indefinitely in
  // React Native when there are keychain/SecureStore contention issues.
  // A second tap while signing in gets the same outcome as the first.
  const signInFlightRef = useRef<Promise<void> | null>(null);
  function signIn(email: string, password: string): Promise<void> {
    if (signInFlightRef.current) return signInFlightRef.current;
    const flight = runSignIn(email, password).finally(() => {
      signInFlightRef.current = null;
    });
    signInFlightRef.current = flight;
    return flight;
  }

  async function runSignIn(email: string, password: string) {
    try {
      setLoading(true);
      authBusyRef.current = true;

      // Purge any stale local session, without a network call (CT7-067).
      await clearLocalSession();

      // Call Supabase Auth REST API directly (avoids SDK hang)
      const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || '';
      const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || '';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // GoTrue returns { error_code, msg } (newer) or { error, error_description }
        const err = new Error(
          body.msg ||
            body.error_description ||
            body.message ||
            body.error ||
            `Auth failed (${res.status})`
        );
        (err as any).code = body.error_code || body.code || body.error;
        throw err;
      }

      const data = await res.json();

      // CT7-067: session attached and profile loaded before the user counts
      // as signed in; the login screen navigates once the profile is set.
      await completeSignIn(data);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('Sign in timed out (12s)');
        throw new Error('Sign in timed out. Check your network connection.');
      }
      console.error('Sign in error:', error);
      const wrapped = new Error(error.message || 'Failed to sign in');
      (wrapped as any).code = error.code; // keep the auth error code for the message
      throw wrapped;
    } finally {
      authBusyRef.current = false;
      setLoading(false);
    }
  }

  // Sign out function
  async function signOut() {
    try {
      setLoading(true);
      clearPendingVendorSelection();
      await clearDashboardCaches();
      // Stop this phone receiving this user's push notifications (needs the
      // session, so before signing out).
      await unregisterDevicePush();
      // Sign out of THIS device only. The default ('global') revoked the
      // user's sessions on every phone, so signing out on one device
      // logged them out everywhere.
      const { error } = await supabase.auth.signOut({ scope: 'local' });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error(error.message || 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  }

  // Refresh profile
  async function refreshProfile() {
    if (user) {
      // without the token the read is anonymous and RLS returns no profile
      const profile = await fetchProfile(user.id, session?.access_token);
      setProfile(profile);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
