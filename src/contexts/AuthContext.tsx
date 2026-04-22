import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Database } from '@/src/types/database.types';
import { supabase } from '@/src/lib/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: 'owner' | 'tenant') => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from database
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data as Profile;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  // Initialize auth state
  useEffect(() => {
    // Get initial session — explicitly handle expired cached sessions.
    // After 3+ days the access token in AsyncStorage is stale. If the
    // refresh token is also expired, the Supabase client can enter a broken
    // state that causes signInWithPassword to hang. We detect that here and
    // clear the cache so the client starts clean.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const nowSecs = Date.now() / 1000;
        const isExpired = (session.expires_at ?? 0) < nowSecs;
        if (isExpired) {
          // Try to refresh — if the refresh token is still valid, great.
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (!refreshed.session) {
            // Refresh token also expired: clear the stale cache locally.
            await supabase.auth.signOut({ scope: 'local' });
            setLoading(false);
            return;
          }
          // Refreshed successfully — use the new session.
          setSession(refreshed.session);
          setUser(refreshed.session.user);
          fetchProfile(refreshed.session.user.id).then(setProfile);
          setLoading(false);
          return;
        }
      }

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).then(setProfile);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setProfile(profile);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sign up function
  async function signUp(email: string, password: string, fullName: string, role: 'owner' | 'tenant') {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('Sign up failed — no user returned');

      // Create profile row immediately
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        email,
        role,
      });
      if (profileError) throw new Error(profileError.message);

      // Fetch the newly created profile so AuthContext state is populated
      const profile = await fetchProfile(data.user.id);
      if (!profile) throw new Error('Profile creation failed — please try again');
      setProfile(profile);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }

  // Sign in function
  async function signIn(email: string, password: string) {
    try {
      setLoading(true);
      // Purge any stale cached session before signing in.
      // scope:'local' = clears AsyncStorage only, no server call.
      // Prevents an expired cached session from causing signInWithPassword to hang.
      await supabase.auth.signOut({ scope: 'local' });
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
    } catch (error: any) {
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
