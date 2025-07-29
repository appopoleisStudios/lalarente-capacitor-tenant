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
  signUpOwner: (ownerData: {
    email: string
    password: string
    fullName: string
    idNumber: string
    phone: string
    portfolioSize: string
    ficaDocuments: File
  }) => Promise<{ success: boolean }>
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
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'An unknown error occurred', isLoading: false })
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
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'An unknown error occurred', isLoading: false })
      return { success: false }
    }
  },

  signUpOwner: async (ownerData: {
    email: string
    password: string
    fullName: string
    idNumber: string
    phone: string
    portfolioSize: string
    ficaDocuments: File
  }) => {
    set({ isLoading: true, error: null })
    try {
      // 1. Create auth user
      const { data, error } = await supabase.auth.signUp({ 
        email: ownerData.email, 
        password: ownerData.password 
      })
      
      if (error) throw error
      if (!data.user) throw new Error('No user returned')

      // 2. Upload FICA document
      const fileName = `fica-documents/${data.user.id}/${ownerData.ficaDocuments.name}`
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, ownerData.ficaDocuments)
      
      if (uploadError) throw uploadError

      // 3. Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName)

      // 4. Insert into profiles table with owner-specific data
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: data.user.id,
          full_name: ownerData.fullName,
          role: 'owner',
          phone: ownerData.phone,
          verification_status: false,
          fica_documents: {
            id_number: ownerData.idNumber,
            portfolio_size: ownerData.portfolioSize,
            document_url: urlData.publicUrl,
            uploaded_at: new Date().toISOString()
          }
        }])
      
      if (profileError) throw profileError

      const newProfile: Profile = {
        id: data.user.id,
        full_name: ownerData.fullName,
        role: 'owner',
        phone: ownerData.phone,
        avatar_url: null,
        verification_status: false,
        fica_documents: {
          id_number: ownerData.idNumber,
          portfolio_size: ownerData.portfolioSize,
          document_url: urlData.publicUrl,
          uploaded_at: new Date().toISOString()
        },
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
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'An unknown error occurred', isLoading: false })
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
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'An unknown error occurred', isLoading: false })
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
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'An unknown error occurred' })
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
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'An unknown error occurred', isInitialized: true, isLoading: false })
    }
  }
}))
