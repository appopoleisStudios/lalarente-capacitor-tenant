import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabaseClient';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

export interface AdminProfile {
  id: string;
  full_name: string;
  email: string | null;
  role: 'admin';
  dev_admin: boolean;
  avatar_url: string | null;
}

interface AuthState {
  user: User | null;
  profile: AdminProfile | null;
  loading: boolean;
  isDevAdmin: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const isDevAdmin = profile?.dev_admin === true;

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, dev_admin, avatar_url')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Failed to load profile:', error);
      return null;
    }

    // Only allow admin role
    if (data?.role !== 'admin') {
      return null;
    }

    return data as AdminProfile;
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: Session | null } }) => {
      if (session?.user) {
        const p = await loadProfile(session.user.id);
        setUser(session.user);
        setProfile(p);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const p = await loadProfile(session.user.id);
          setProfile(p);
        } else {
          setProfile(null);
        }
      }
    );

    return () => listener?.subscription.unsubscribe();
  }, []);

  async function signIn(
    email: string,
    password: string
  ): Promise<string | null> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return error.message;
    if (!data.user) return 'Sign in failed';

    const p = await loadProfile(data.user.id);
    if (!p) {
      await supabase.auth.signOut();
      return 'Access denied. Only admin users can access this panel.';
    }

    return null;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, isDevAdmin, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
