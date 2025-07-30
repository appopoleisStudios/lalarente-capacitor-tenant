// src/components/DashboardLayout.tsx
'use client'

import { useAuthStore } from '@/store/authStore'
import BottomNavbar from './BottomNavbar'
import { getValidUserRole, ValidUserRole } from '@/utils/roleValidation'

interface DashboardLayoutProps {
  children: React.ReactNode
  userRole?: ValidUserRole
}

export default function DashboardLayout({ children, userRole }: DashboardLayoutProps) {
  const { profile } = useAuthStore()
  
  // Safely extract and validate the role
  const backendRole = profile?.role
  const role: ValidUserRole | undefined = getValidUserRole(userRole, backendRole)

  return (
    <div className="min-h-screen relative">
      {/* Main Content */}
      <div className="pb-20">
        {children}
      </div>
      
      {/* Bottom Navigation */}
      {role && <BottomNavbar userRole={role} />}
    </div>
  )
}
