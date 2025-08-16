import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { supabase, type Profile, type UserRole } from '@/lib/supabase'
import { validateIdDocumentFile } from '@/utils/fileValidation'
import { uploadSecureDocument, FicaDocumentData } from '@/utils/secureDocuments'
import { validatePasswordStrength } from '@/utils/password'

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
  checkEmailExists: (email: string) => Promise<boolean>
  checkIdNumberExists: (idNumber: string, role: UserRole) => Promise<boolean>
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
      
      // Determine redirect based on role and onboarding flags
      const profile = get().profile as (Profile & {
        onboarding_owner_done?: boolean
        onboarding_tenant_done?: boolean
        onboarding_vendor_done?: boolean
      }) | null
      let redirectTo = '/dashboard'
      
      if (profile?.role) {
        switch (profile.role) {
          case 'tenant':
            redirectTo = profile.onboarding_tenant_done ? '/dashboard/tenant' : '/onboarding/user-type'
            break
          case 'owner':
            redirectTo = profile.onboarding_owner_done ? '/dashboard/owner' : '/onboarding/user-type'
            break
          case 'vendor':
            redirectTo = profile.onboarding_vendor_done ? '/dashboard/vendor' : '/onboarding/user-type'
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
      // Basic duplicate checks already handled server-side; enforce password policy client-side
      const pw = validatePasswordStrength(password)
      if (!pw.isValid) {
        throw new Error(pw.message || 'Weak password')
      }
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
        email: null,
        avatar_url: null,
        verification_status: false,
        fica_documents: null,
        bank_details: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        onboarding_owner_done: false,
        onboarding_tenant_done: false,
        onboarding_vendor_done: false
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
      const pw = validatePasswordStrength(ownerData.password)
      if (!pw.isValid) {
        throw new Error(pw.message || 'Weak password')
      }
      // 0. Check for duplicate email and ID number
      const emailExists = await get().checkEmailExists(ownerData.email)
      if (emailExists) {
        throw new Error('This email address is already registered. Please use a different email or try signing in.')
      }

      const idNumberExists = await get().checkIdNumberExists(ownerData.idNumber, 'owner')
      if (idNumberExists) {
        throw new Error('This ID number is already registered. Please use a different ID number or contact support if this is an error.')
      }

      // 1. Validate file before processing
      const fileValidation = validateIdDocumentFile(ownerData.ficaDocuments)
      if (!fileValidation.isValid) {
        throw new Error(fileValidation.error || 'Invalid file provided')
      }

      // 1. Create auth user
      console.log('Creating auth user...')
      const { data, error } = await supabase.auth.signUp({ 
        email: ownerData.email, 
        password: ownerData.password 
      })
      
      if (error) {
        console.error('Auth signup error:', error)
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          throw new Error('This email address is already registered in our system. Please use a different email address or try signing in with your existing account.')
        }
        throw error
      }
      if (!data.user) throw new Error('No user returned')

      console.log('Auth user created successfully:', data.user.id)

      // 2. Upload FICA document securely
      console.log('Uploading FICA document securely...')
      const uploadResult = await uploadSecureDocument(
        ownerData.ficaDocuments,
        data.user.id,
        'owner'
      )
      
      if (uploadResult.error) {
        console.error('Secure file upload error:', uploadResult.error)
        throw new Error(uploadResult.error)
      }

      const filePath = uploadResult.filePath

      // 4. Insert into profiles table with owner-specific data
      console.log('Creating profile...')
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: data.user.id,
          full_name: ownerData.fullName,
          role: 'owner',
          phone: ownerData.phone,
          email: ownerData.email,
          verification_status: false,
          fica_documents: {
            id_number: ownerData.idNumber,
            portfolio_size: ownerData.portfolioSize,
            document_path: filePath,
            uploaded_at: new Date().toISOString()
          }
        }])
      
      if (profileError) {
        console.error('Profile creation error:', profileError)
        
        // Check if this is a duplicate ID number error from the database trigger
        if (profileError.message && profileError.message.includes('already registered by another user')) {
          throw new Error('This ID number is already registered by another user. Please use a different ID number or contact support if this is an error.')
        }
        
        // Check if this is a duplicate email error
        if (profileError.message && (profileError.message.includes('duplicate key') || profileError.message.includes('already exists'))) {
          throw new Error('This email address is already registered. Please use a different email or try signing in.')
        }
        
        throw profileError
      }

      const newProfile: Profile = {
        id: data.user.id,
        full_name: ownerData.fullName,
        role: 'owner',
        phone: ownerData.phone,
        email: ownerData.email,
        avatar_url: null,
        verification_status: false,
        fica_documents: {
          id_number: ownerData.idNumber,
          portfolio_size: ownerData.portfolioSize,
          document_path: filePath,
          uploaded_at: new Date().toISOString()
        },
        bank_details: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        onboarding_owner_done: false,
        onboarding_tenant_done: false,
        onboarding_vendor_done: false
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
      const pw = validatePasswordStrength(tenantData.password)
      if (!pw.isValid) {
        throw new Error(pw.message || 'Weak password')
      }
      // 0. Check for duplicate email and ID number
      const emailExists = await get().checkEmailExists(tenantData.email)
      if (emailExists) {
        throw new Error('This email address is already registered. Please use a different email or try signing in.')
      }

      const idNumberExists = await get().checkIdNumberExists(tenantData.idNumber, 'tenant')
      if (idNumberExists) {
        throw new Error('This ID number is already registered. Please use a different ID number or contact support if this is an error.')
      }

      // 1. Validate file before processing
      const fileValidation = validateIdDocumentFile(tenantData.idDocument)
      if (!fileValidation.isValid) {
        throw new Error(fileValidation.error || 'Invalid file provided')
      }

      // 1. Create auth user
      console.log('Creating auth user...')
      const { data, error } = await supabase.auth.signUp({ 
        email: tenantData.email, 
        password: tenantData.password 
      })
      
      if (error) {
        console.error('Auth signup error:', error)
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          throw new Error('This email address is already registered in our system. Please use a different email address or try signing in with your existing account.')
        }
        throw error
      }
      if (!data.user) throw new Error('No user returned')

      console.log('Auth user created successfully:', data.user.id)

      // 2. Upload ID document securely
      console.log('Uploading ID document securely...')
      const uploadResult = await uploadSecureDocument(
        tenantData.idDocument,
        data.user.id,
        'tenant'
      )
      
      if (uploadResult.error) {
        console.error('Secure file upload error:', uploadResult.error)
        throw new Error(uploadResult.error)
      }

      const filePath = uploadResult.filePath

      // 4. Insert into profiles table with tenant-specific data
      console.log('Creating profile...')
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: data.user.id,
          full_name: tenantData.fullName,
          role: 'tenant',
          phone: tenantData.phone,
          email: tenantData.email,
          verification_status: false,
          fica_documents: {
            id_number: tenantData.idNumber,
            monthly_income: null,
            employment_status: null,
            document_path: filePath,
            uploaded_at: new Date().toISOString()
          }
        }])
      
      if (profileError) {
        console.error('Profile creation error:', profileError)
        
        // Check if this is a duplicate ID number error from the database trigger
        if (profileError.message && profileError.message.includes('already registered by another user')) {
          throw new Error('This ID number is already registered by another user. Please use a different ID number or contact support if this is an error.')
        }
        
        // Check if this is a duplicate email error
        if (profileError.message && (profileError.message.includes('duplicate key') || profileError.message.includes('already exists'))) {
          throw new Error('This email address is already registered. Please use a different email or try signing in.')
        }
        
        throw profileError
      }

      const newProfile: Profile = {
        id: data.user.id,
        full_name: tenantData.fullName,
        role: 'tenant',
        phone: tenantData.phone,
        email: tenantData.email,
        avatar_url: null,
        verification_status: false,
        fica_documents: {
          id_number: tenantData.idNumber,
          monthly_income: null,
          employment_status: null,
          document_path: filePath,
          uploaded_at: new Date().toISOString()
        },
        bank_details: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        onboarding_owner_done: false,
        onboarding_tenant_done: false,
        onboarding_vendor_done: false
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
      // after sign-out, redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login'
      }
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'An unknown error occurred', isLoading: false })
    }
  },

  fetchProfile: async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId)
      
      // Add retry mechanism for profile fetch
      let retries = 3
      let profileData = null
      let profileError = null
      
      while (retries > 0 && !profileData) {
        try {
          // First try to get just the basic profile data without the JSON fields
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, role, phone, email, avatar_url, verification_status, created_at, updated_at') // Added email here
            .eq('id', userId)
            .single()
          
          if (error) {
            profileError = error
            if (error.code === 'PGRST116') {
              console.log(`Profile not found for user: ${userId}, retries left: ${retries - 1}`)
              if (retries > 1) {
                // Wait a bit before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)))
                retries--
                continue
              } else {
                console.log('Profile not found after all retries - this is normal for new registrations')
                return
              }
            }
            throw error
          }
          
          profileData = data
          console.log('Basic profile fetched successfully:', profileData)
          break
          
        } catch (error) {
          profileError = error
          if (retries > 1) {
            console.log(`Profile fetch failed, retrying... (${retries - 1} retries left)`)
            await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)))
            retries--
          } else {
            throw error
          }
        }
      }
      
      if (!profileData) {
        console.log('Could not fetch profile after all retries')
        return
      }
      
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
           const basicProfileWithDefaults: Profile = {
             ...profileData,
             email: null,
             fica_documents: null,
             bank_details: null,
             onboarding_owner_done: false,
             onboarding_tenant_done: false,
             onboarding_vendor_done: false
           }
           set({ profile: basicProfileWithDefaults })
         }
             } catch (jsonError) {
         console.log('JSON fields fetch failed, using basic profile:', jsonError)
         // Add missing fields with null values to satisfy TypeScript
         const basicProfileWithDefaults: Profile = {
           ...profileData,
           email: null,
           fica_documents: null,
           bank_details: null,
           onboarding_owner_done: false,
           onboarding_tenant_done: false,
           onboarding_vendor_done: false
         }
         set({ profile: basicProfileWithDefaults })
       }
      
    } catch (error: unknown) {
      // Only log non-PGRST116 errors as they're more serious
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'PGRST116') {
        console.error('fetchProfile error:', error)
      }
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
  },

  checkEmailExists: async (email: string) => {
    try {
      console.log('🔍 Checking for existing email (RPC):', email)
      
      // Use RPC function to check if email exists
      const { data, error } = await supabase.rpc('check_email_exists', {
        email_to_check: email.trim()
      })

      if (error) {
        console.error('❌ Error in RPC email check:', error)
        console.log('⚠️ RPC error occurred, blocking registration for safety.')
        return true
      }

      console.log('📊 RPC check_email_exists returned:', data)
      
      if (data === true) {
        console.log('🚨 DUPLICATE EMAIL DETECTED via RPC! Blocking registration.')
        return true
      }
      
      console.log('✅ Email is unique (RPC), allowing registration.')
      return false
    } catch (error) {
      console.error('❌ Error in RPC email check:', error)
      console.log('⚠️ Error occurred during RPC check, blocking registration for safety.')
      return true
    }
  },

  checkIdNumberExists: async (idNumber: string, role: UserRole) => {
    try {
      console.log(`🔍 Checking for existing ID number (RPC) for role ${role}:`, idNumber)
      
      // Use the role-based RPC function
      const { data, error } = await supabase.rpc('check_id_exists_for_role', {
        id_num: idNumber.trim(),
        user_role: role
      })

      if (error) {
        console.error('❌ Error in RPC ID number check:', error)
        console.log('⚠️ RPC error occurred, blocking registration for safety.')
        return true
      }

      console.log(`📊 RPC check_id_exists_for_role returned for ${role}:`, data)
      
      if (data === true) {
        console.log(`🚨 DUPLICATE ID DETECTED for role ${role} via RPC! Blocking registration.`)
        return true
      }
      
      console.log(`✅ ID number is unique for role ${role} (RPC), allowing registration.`)
      return false
    } catch (error) {
      console.error('❌ Error in RPC ID number check:', error)
      console.log('⚠️ Error occurred during RPC check, blocking registration for safety.')
      return true
    }
  }
}))

