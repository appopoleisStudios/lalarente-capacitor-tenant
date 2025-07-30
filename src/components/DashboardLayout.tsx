// src/components/DashboardLayout.tsx
'use client'

import { useAuthStore } from '@/store/authStore'
import BottomNavbar from './BottomNavbar'

interface DashboardLayoutProps {
  children: React.ReactNode
  userRole?: 'tenant' | 'owner'
}

export default function DashboardLayout({ children, userRole }: DashboardLayoutProps) {
  const { profile } = useAuthStore()
  const role = userRole || profile?.role

  return (
    <div className="min-h-screen relative">
      {/* Main Content */}
      <div className="pb-20">
        {children}
      </div>
      
      {/* Bottom Navigation */}
      {role && <BottomNavbar userRole={role as 'tenant' | 'owner'} />}
    </div>
  )
}
