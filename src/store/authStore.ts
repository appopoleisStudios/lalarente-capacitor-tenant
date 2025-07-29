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
  signUpTenant: (tenantData: {
    email: string
    password: string
    fullName: string
    idNumber: string
    phone: string
    idDocument: File
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
    console.log('signUpOwner called with data:', ownerData)
    set({ isLoading: true, error: null })
    try {
      // 1. Create auth user
      console.log('Creating auth user...')
      const { data, error } = await supabase.auth.signUp({ 
        email: ownerData.email, 
        password: ownerData.password 
      })
      
      if (error) {
        console.error('Auth signup error:', error)
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          throw new Error('This email is already registered. Please use a different email or try signing in.')
        }
        throw error
      }
      if (!data.user) throw new Error('No user returned')

      console.log('Auth user created successfully:', data.user.id)

      // 2. Upload FICA document
      console.log('Uploading FICA document...')
      const fileName = `fica-documents/${data.user.id}/${ownerData.ficaDocuments.name}`
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, ownerData.ficaDocuments)
      
      if (uploadError) {
        console.error('File upload error:', uploadError)
        throw uploadError
      }

      // 3. Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName)

      // 4. Insert into profiles table with owner-specific data
      console.log('Creating profile...')
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
      
      if (profileError) {
        console.error('Profile creation error:', profileError)
        throw profileError
      }

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

  signUpTenant: async (tenantData: {
    email: string
    password: string
    fullName: string
    idNumber: string
    phone: string
    idDocument: File
  }) => {
    console.log('signUpTenant called with data:', tenantData)
    set({ isLoading: true, error: null })
    try {
      // 1. Create auth user
      console.log('Creating auth user...')
      const { data, error } = await supabase.auth.signUp({ 
        email: tenantData.email, 
        password: tenantData.password 
      })
      
      if (error) {
        console.error('Auth signup error:', error)
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          throw new Error('This email is already registered. Please use a different email or try signing in.')
        }
        throw error
      }
      if (!data.user) throw new Error('No user returned')

      console.log('Auth user created successfully:', data.user.id)

      // 2. Upload ID document
      console.log('Uploading ID document...')
      const fileName = `tenant-documents/${data.user.id}/${tenantData.idDocument.name}`
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, tenantData.idDocument)
      
      if (uploadError) {
        console.error('File upload error:', uploadError)
        throw uploadError
      }

      // 3. Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName)

      // 4. Insert into profiles table with tenant-specific data
      console.log('Creating profile...')
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: data.user.id,
          full_name: tenantData.fullName,
          role: 'tenant',
          phone: tenantData.phone,
          verification_status: false,
          fica_documents: {
            id_number: tenantData.idNumber,
            monthly_income: null,
            employment_status: null,
            document_url: urlData.publicUrl,
            uploaded_at: new Date().toISOString()
          }
        }])
      
      if (profileError) {
        console.error('Profile creation error:', profileError)
        throw profileError
      }

      const newProfile: Profile = {
        id: data.user.id,
        full_name: tenantData.fullName,
        role: 'tenant',
        phone: tenantData.phone,
        avatar_url: null,
        verification_status: false,
        fica_documents: {
          id_number: tenantData.idNumber,
          monthly_income: null,
          employment_status: null,
          document_url: urlData.publicUrl,
          uploaded_at: new Date().toISOString()
        },
        bank_details: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      console.log('Profile created successfully, setting user state...')
      set({ 
        user: data.user, 
        profile: newProfile, 
        isLoading: false 
      })
      
      console.log('signUpTenant completed successfully')
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
      console.log('Fetching profile for user:', userId)
      
      // First try to get just the basic profile data without the JSON fields
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, role, phone, avatar_url, verification_status, created_at, updated_at')
        .eq('id', userId)
        .single()
      
      if (profileError) {
        console.error('Profile fetch error:', profileError)
        // If profile doesn't exist, don't set an error, just log it
        if (profileError.code === 'PGRST116') {
          console.log('Profile not found for user:', userId)
          return
        }
        throw profileError
      }
      
      console.log('Basic profile fetched successfully:', profileData)
      
      // Now try to get the JSON fields separately to avoid 406 errors
      try {
        const { data: fullProfileData, error: fullProfileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        
        if (!fullProfileError && fullProfileData) {
          console.log('Full profile fetched successfully:', fullProfileData)
          set({ profile: fullProfileData })
        } else {
          console.log('Using basic profile data due to JSON field issues')
          // Add missing fields with null values to satisfy TypeScript
          const basicProfileWithDefaults = {
            ...profileData,
            fica_documents: null,
            bank_details: null
          }
          set({ profile: basicProfileWithDefaults })
        }
      } catch (jsonError) {
        console.log('JSON fields fetch failed, using basic profile:', jsonError)
        // Add missing fields with null values to satisfy TypeScript
        const basicProfileWithDefaults = {
          ...profileData,
          fica_documents: null,
          bank_details: null
        }
        set({ profile: basicProfileWithDefaults })
      }
      
    } catch (error: unknown) {
      console.error('fetchProfile error:', error)
      // Don't set error state for profile fetch failures as they're not critical
      // set({ error: error instanceof Error ? error.message : 'An unknown error occurred' })
    }
  },

  initialize: async () => {
    set({ isLoading: true })
    try {
      console.log('Initializing auth store...')
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Session error:', error)
        throw error
      }
      
      if (session?.user) {
        console.log('User session found:', session.user.id)
        set({ user: session.user })
        try {
          await get().fetchProfile(session.user.id)
        } catch (profileError) {
          console.error('Failed to fetch profile during initialization:', profileError)
          // Don't fail initialization if profile fetch fails
        }
      } else {
        console.log('No user session found')
      }
      
      set({ isInitialized: true, isLoading: false })
      console.log('Auth store initialized successfully')
    } catch (error: unknown) {
      console.error('Auth store initialization error:', error)
      set({ error: error instanceof Error ? error.message : 'An unknown error occurred', isInitialized: true, isLoading: false })
    }
  }
}))
