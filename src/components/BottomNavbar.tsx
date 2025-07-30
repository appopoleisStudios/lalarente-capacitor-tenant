'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

interface BottomNavbarProps {
  userRole: 'tenant' | 'owner'
}

export default function BottomNavbar({ userRole }: BottomNavbarProps) {
  const router = useRouter()
  const pathname = usePathname()

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

  const tabs = userRole === 'tenant' ? tenantTabs : ownerTabs
  const activeColor = userRole === 'tenant' ? 'emerald' : 'blue'

  const handleTabPress = (path: string) => {
    router.push(path)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-around py-2">
          {tabs.map((tab) => {
            const isActive = pathname === tab.path
            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab.path)}
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
                      ? `text-${activeColor}-600` 
                      : 'text-gray-400'
                  }`}
                ></i>
                
                {/* Label */}
                <span 
                  className={`text-xs font-medium ${
                    isActive 
                      ? `text-${activeColor}-600` 
                      : 'text-gray-400'
                  }`}
                >
                  {tab.label}
                </span>
                
                {/* Active Indicator */}
                {isActive && (
                  <div 
                    className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-${activeColor}-600 rounded-full`}
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
