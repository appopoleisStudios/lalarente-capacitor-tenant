import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Database } from '@/src/types/database.types';
import { supabase } from '@/src/lib/supabase';
import { clearPendingVendorSelection } from '@/src/features/maintenance/api/vendors/pendingVendorSelection';
import { clearDashboardCaches } from '@/src/shared/utils/dashboardCache';
import { unregisterDevicePush } from '@/src/features/notifications/registerPush';

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
// nothing and the tenant saw "Welcome back, Tenant" with no home. The session
// is now attached and checked before the user is treated as signed in.
export const ATTACH_SESSION_TIMEOUT_MS = 4_000;
export const ATTACH_SESSION_ATTEMPTS = 2;

export class SessionAttachError extends Error {
  code = 'session_not_attached';
  constructor() {
    super("Couldn't finish signing in");
    this.name = 'SessionAttachError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/** Store the session in supabase-js and confirm it belongs to `userId`. */
async function attachSession(
  tokens: { access_token: string; refresh_token: string },
  userId: string
): Promise<void> {
  for (let i = 0; i < ATTACH_SESSION_ATTEMPTS; i++) {
    try {
      const attached = await withTimeout(
        (async () => {
          const { error } = await supabase.auth.setSession(tokens);
          if (error) return false;
          const { data } = await supabase.auth.getSession();
          return data.session?.user?.id === userId;
        })(),
        ATTACH_SESSION_TIMEOUT_MS
      );
      if (attached) return;
    } catch {
      // timed out or threw: try again
    }
  }
  throw new SessionAttachError();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // signIn() clears any stale local session first; that SIGNED_OUT event can
  // arrive after the new session is set and bounce the user back to the
  // login screen (the "sign-in screen flashes" bug). Ignore it while signing in.
  const signingInRef = useRef(false);
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
      if (_event === 'SIGNED_OUT' && signingInRef.current) return;
      if (_event === 'SIGNED_IN') signingInRef.current = false;
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
            .then(setProfile)
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

  // Sign up function — calls register-user edge function to bypass email confirmation
  async function signUp(
    email: string,
    password: string,
    fullName: string,
    role: 'owner' | 'tenant' | 'vendor',
    businessName?: string
  ) {
    try {
      setLoading(true);

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

      // CT7-067: the session must be in supabase-js before the app uses it.
      await attachSession(
        {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        },
        data.user.id
      );

      setSession(data.session);
      setUser(data.user);

      // Fetch profile
      const profile = await fetchProfile(data.user.id, data.session.access_token);
      if (profile) {
        setProfile(profile);
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }

  // Sign in function — uses REST API directly instead of supabase-js SDK
  // because supabase.auth.signInWithPassword() can hang indefinitely in
  // React Native when there are keychain/SecureStore contention issues.
  async function signIn(email: string, password: string) {
    try {
      setLoading(true);
      signingInRef.current = true;
      // never let the guard stick if SIGNED_IN is somehow missed
      setTimeout(() => {
        signingInRef.current = false;
      }, 20000);

      // Purge stale session from SecureStore — fire-and-forget (no await) to
      // avoid a supabase-js hang blocking the REST login that follows.
      supabase.auth.signOut({ scope: 'local' }).catch(() => {});

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

      // CT7-067: attach the session to supabase-js (bounded, retried once)
      // BEFORE the user counts as signed in; otherwise every query would run
      // without it. On failure sign-in fails with a clear message.
      await attachSession(
        { access_token: data.access_token, refresh_token: data.refresh_token },
        data.user.id
      );

      setSession(data as any);
      setUser(data.user);
      // The SIGNED_IN event from setSession may already have fetched it.
      if (profileUserIdRef.current !== data.user.id) {
        profileUserIdRef.current = data.user.id;
        fetchProfile(data.user.id, data.access_token)
          .then(setProfile)
          .catch(() => {
            profileUserIdRef.current = null;
          });
      }

      // Loading stays true until the navigation effect fires (watching profile)
      // or the safety timeout in handleLogin (15s) kicks in.
    } catch (error: any) {
      signingInRef.current = false;
      if (error.name === 'AbortError') {
        console.error('Sign in timed out (12s)');
        throw new Error('Sign in timed out. Check your network connection.');
      }
      console.error('Sign in error:', error);
      const wrapped = new Error(error.message || 'Failed to sign in');
      (wrapped as any).code = error.code; // keep the auth error code for the message
      throw wrapped;
    } finally {
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
