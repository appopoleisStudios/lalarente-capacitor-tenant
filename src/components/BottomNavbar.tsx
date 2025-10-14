'use client'

import { useRouter, usePathname } from 'next/navigation'
// import { useAuthStore } from '@/store/authStore'

interface BottomNavbarProps {
  userRole: 'tenant' | 'owner' | 'vendor' | 'admin'
}

export default function BottomNavbar({ userRole }: BottomNavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  // const { signOut } = useAuthStore()

  // Color mapping for active states
  const activeColorClasses = {
    emerald: 'text-emerald-600 bg-emerald-600',
    blue: 'text-blue-600 bg-blue-600',
    indigo: 'text-indigo-600 bg-indigo-600',
  } as const

  const tenantTabs = [
    {
      id: 'home',
      label: 'Home',
      icon: 'fas fa-home',
      path: '/dashboard/tenant',
      badge: null
    },
    {
      id: 'search',
      label: 'Search',
      icon: 'fas fa-search',
      path: '/properties/search',
      badge: null
    },
    {
      id: 'payments',
      label: 'Payments',
      icon: 'fas fa-credit-card',
      path: '/tenant/payments',
      badge: null
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      icon: 'fas fa-tools',
      path: '/tenant/maintenance',
      badge: 2 // Example: 2 active requests
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: 'fas fa-user',
      path: '/tenant/profile',
      badge: null
    }
  ]

  const ownerTabs = [
    {
      id: 'home',
      label: 'Home',
      icon: 'fas fa-home',
      path: '/dashboard/owner',
      badge: null
    },
    {
      id: 'properties',
      label: 'Properties',
      icon: 'fas fa-building',
      path: '/owner/properties',
      badge: null
    },
    {
      id: 'tenants',
      label: 'Tenants',
      icon: 'fas fa-users',
      path: '/owner/tenants',
      badge: null
    },
    {
      id: 'income',
      label: 'Income',
      icon: 'fas fa-chart-line',
      path: '/owner/income',
      badge: null
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: 'fas fa-user',
      path: '/owner/profile',
      badge: null
    }
  ]

  const vendorTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-home', path: '/dashboard/vendor', badge: null },
    { id: 'jobs', label: 'Jobs', icon: 'fas fa-briefcase', path: '/dashboard/vendor/jobs', badge: null },
    { id: 'payments', label: 'Payments', icon: 'fas fa-credit-card', path: '/dashboard/vendor/payments', badge: null },
    { id: 'analytics', label: 'Analytics', icon: 'fas fa-chart-line', path: '/dashboard/vendor/analytics', badge: null },
    { id: 'profile', label: 'Profile', icon: 'fas fa-user', path: '/dashboard/vendor/profile', badge: null },
  ]

  const adminTabs = [
    {
      id: 'home',
      label: 'Admin',
      icon: 'fas fa-shield-alt',
      path: '/admin',
      badge: null
    }
  ]

  const baseTabs = userRole === 'tenant' ? tenantTabs : userRole === 'owner' ? ownerTabs : userRole === 'vendor' ? vendorTabs : adminTabs

  const tabs = [...baseTabs]
  // Add About icon only for debug builds (controlled via env)
  if (process.env.NEXT_PUBLIC_DEBUG_ABOUT === '1') {
    tabs.push({ id: 'about', label: 'About', icon: 'fas fa-circle-info', path: '/about', badge: null } as any)
  }
  const activeColor = userRole === 'tenant' ? 'emerald' : userRole === 'vendor' ? 'indigo' : 'blue'

  const handleTabPress = (path: string) => {
    router.push(path)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom overflow-hidden">
      <div className="w-full">
        <div className="flex items-center justify-around py-2">
          {tabs.map((tab) => {
            const isActive = pathname === tab.path
            return (
              <button
                key={tab.id}
                onClick={async () => {
                  handleTabPress(tab.path)
                }}
                className="flex flex-col items-center py-2 px-3 min-w-0 flex-1 relative"
              >
                {/* Badge */}
                {tab.badge && (
                  <div className="absolute -top-1 right-1/2 transform translate-x-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{tab.badge}</span>
                  </div>
                )}
                
                {/* Icon */}
                <i 
                  className={`${tab.icon} text-lg mb-1 ${
                    isActive 
                      ? activeColorClasses[activeColor as keyof typeof activeColorClasses]?.split(' ')[0] || 'text-gray-600'
                      : 'text-gray-400'
                  }`}
                ></i>
                
                {/* Label */}
                <span 
                  className={`text-xs font-medium ${
                    isActive 
                      ? activeColorClasses[activeColor as keyof typeof activeColorClasses]?.split(' ')[0] || 'text-gray-600'
                      : 'text-gray-400'
                  }`}
                >
                  {tab.label}
                </span>
                
                {/* Active Indicator */}
                {isActive && (
                  <div 
                    className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 rounded-full ${
                      activeColorClasses[activeColor as keyof typeof activeColorClasses]?.split(' ')[1] || 'bg-gray-600'
                    }`}
                  ></div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
