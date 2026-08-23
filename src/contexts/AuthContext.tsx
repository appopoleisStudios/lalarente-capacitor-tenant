import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Database } from '@/src/types/database.types';
import { supabase } from '@/src/lib/supabase';
import { clearPendingVendorSelection } from '@/src/features/maintenance/api/vendors/pendingVendorSelection';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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
            fetchProfile(refreshed.session.user.id, refreshed.session.access_token).then(
              setProfile
            );
            return;
          }
        }

        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
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
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Fire-and-forget profile fetch — supabase-js SDK can hang on ANY
        // database call when SecureStore is contending (not just signIn),
        // so we must NOT block the auth state handler with an await.
        // Pass the session access_token so the REST call is authenticated.
        fetchProfile(session.user.id, session.access_token)
          .then(setProfile)
          .catch(() => {});
      } else {
        clearPendingVendorSelection();
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

      // Set session in supabase-js (fire-and-forget)
      supabase.auth
        .setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
        .catch((err: any) => console.error('signUp setSession error:', err));

      // Manually set session state immediately so navigation is unblocked
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
        throw new Error(body.error_description || body.error || `Auth failed (${res.status})`);
      }

      const data = await res.json();

      // Set the session in supabase-js (fire-and-forget — the SDK itself
      // can hang on SecureStore writes, so we must NOT await it).
      supabase.auth
        .setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
        .catch((err: any) => console.error('setSession error:', err));

      // Manually set session state immediately so navigation is not blocked.
      // The onAuthStateChange handler also fires, but we don't wait for it.
      setSession(data as any);
      setUser(data.user);
      fetchProfile(data.user.id, data.access_token)
        .then(setProfile)
        .catch(() => {});

      // Loading stays true until the navigation effect fires (watching profile)
      // or the safety timeout in handleLogin (15s) kicks in.
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('Sign in timed out (12s)');
        throw new Error('Sign in timed out. Check your network connection.');
      }
      console.error('Sign in error:', error);
      throw new Error(error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }

  // Sign out function
  async function signOut() {
    try {
      setLoading(true);
      clearPendingVendorSelection();
      const { error } = await supabase.auth.signOut();

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
      const profile = await fetchProfile(user.id);
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
