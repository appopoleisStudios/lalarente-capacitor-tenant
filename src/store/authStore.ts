import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { supabase, type Profile, type UserRole } from '@/lib/supabase'

interface AuthState {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  error: string | null
  isInitialized: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setInitialized: (initialized: boolean) => void
  signIn: (email: string, password: string) => Promise<{ success: boolean; redirectTo?: string }>
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<{ success: boolean }>
  signOut: () => Promise<void>
  fetchProfile: (userId: string) => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: false,
  error: null,
  isInitialized: false,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setInitialized: (initialized) => set({ isInitialized: initialized }),

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      })
      
      if (error) throw error
      if (!data.user) throw new Error('No user returned')

      set({ user: data.user })
      await get().fetchProfile(data.user.id)
      
      // Determine redirect based on role
      const profile = get().profile
      let redirectTo = '/dashboard'
      
      if (profile?.role) {
        switch (profile.role) {
          case 'tenant':
            redirectTo = '/dashboard/tenant'
            break
          case 'owner':
            redirectTo = '/dashboard/owner'
            break
          case 'vendor':
            redirectTo = '/dashboard/vendor'
            break
          case 'admin':
            redirectTo = '/admin'
            break
        }
      }
      
      set({ isLoading: false })
      return { success: true, redirectTo }
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      return { success: false }
    }
  },

  signUp: async (email: string, password: string, fullName: string, role: UserRole) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password 
      })
      
      if (error) throw error
      if (!data.user) throw new Error('No user returned')

      // Insert into profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: data.user.id,
          full_name: fullName,
          role: role,
          verification_status: false
        }])
      
      if (profileError) throw profileError

      const newProfile: Profile = {
        id: data.user.id,
        full_name: fullName,
        role: role,
        phone: null,
        avatar_url: null,
        verification_status: false,
        fica_documents: null,
        bank_details: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      set({ 
        user: data.user, 
        profile: newProfile, 
        isLoading: false 
      })
      
      return { success: true }
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      return { success: false }
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      set({ 
        user: null, 
        profile: null, 
        isLoading: false,
        isInitialized: false 
      })
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  fetchProfile: async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (profileError) throw profileError
      set({ profile: profileData })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  initialize: async () => {
    set({ isLoading: true })
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) throw error
      
      if (session?.user) {
        set({ user: session.user })
        await get().fetchProfile(session.user.id)
      }
      
      set({ isInitialized: true, isLoading: false })
    } catch (err: any) {
      set({ error: err.message, isInitialized: true, isLoading: false })
    }
  }
}))
