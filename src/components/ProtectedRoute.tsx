'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { UserRole } from '@/lib/supabase'

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
      // Check if the user's role is in the allowed roles
      if (!allowedRoles.includes(profile.role as UserRole)) {
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
    // Check if the user's role is in the allowed roles
    if (!allowedRoles.includes(profile.role as UserRole)) {
      return null
    }
  }

  return <>{children}</>
}
