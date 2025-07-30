'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { UserRole } from '@/lib/supabase'
import { isValidUserRole } from '@/utils/roleValidation'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: UserRole[]
  redirectTo?: string
}

export default function ProtectedRoute({ 
  children, 
  allowedRoles, 
  redirectTo = '/auth/login' 
}: ProtectedRouteProps) {
  const { user, profile, isLoading, isInitialized } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isInitialized || isLoading) return

    if (!user) {
      router.push(redirectTo)
      return
    }

    if (allowedRoles && profile) {
      // Check if the profile role is valid for frontend use
      if (!isValidUserRole(profile.role)) {
        console.warn(`Unsupported role: ${profile.role}. Redirecting to unauthorized.`)
        router.push('/unauthorized')
        return
      }
      
      // Check if the user's role is in the allowed roles
      if (!allowedRoles.includes(profile.role)) {
        router.push('/unauthorized')
        return
      }
    }
  }, [user, profile, isLoading, isInitialized, allowedRoles, redirectTo, router])

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-sa-green-500"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (allowedRoles && profile) {
    // Check if the profile role is valid for frontend use
    if (!isValidUserRole(profile.role)) {
      return null
    }
    
    // Check if the user's role is in the allowed roles
    if (!allowedRoles.includes(profile.role)) {
      return null
    }
  }

  return <>{children}</>
}
