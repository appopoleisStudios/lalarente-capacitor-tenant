'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function WelcomePage() {
  const { user, profile, isInitialized } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (isInitialized && user && profile) {
      switch (profile.role) {
        case 'tenant':
          router.push('/dashboard/tenant')
          break
        case 'owner':
          router.push('/dashboard/owner')
          break
        case 'vendor':
          router.push('/dashboard/vendor')
          break
        case 'admin':
          router.push('/admin')
          break
      }
    }
  }, [user, profile, isInitialized, router])

  const showPropertyDiscovery = () => {
    router.push('/onboarding/discover')
  }

  return (
    <div className="max-w-md mx-auto min-h-screen shadow-xl bg-gradient-to-b from-blue-50 to-white relative overflow-hidden">
      {/* Background Landmarks Silhouette */}
      <div className="absolute inset-0 opacity-10">
        {/* Table Mountain */}
        <svg className="absolute bottom-0 left-0 w-32 h-20" viewBox="0 0 100 50" fill="currentColor">
          <path d="M0,50 L20,30 L35,25 L50,20 L65,25 L80,30 L100,50 Z" className="text-sa-green-500"/>
        </svg>
        {/* City Skyline */}
        <svg className="absolute bottom-0 right-0 w-40 h-24" viewBox="0 0 120 60" fill="currentColor">
          <rect x="10" y="30" width="8" height="30" className="text-sa-green-500"/>
          <rect x="25" y="20" width="10" height="40" className="text-sa-green-500"/>
          <rect x="40" y="35" width="6" height="25" className="text-sa-green-500"/>
          <rect x="50" y="15" width="12" height="45" className="text-sa-green-500"/>
          <rect x="70" y="25" width="8" height="35" className="text-sa-green-500"/>
          <rect x="85" y="30" width="10" height="30" className="text-sa-green-500"/>
          <rect x="100" y="20" width="8" height="40" className="text-sa-green-500"/>
        </svg>
      </div>
      
      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-10">
        {/* Family Illustration */}
        <div className="mb-8 relative">
          {/* Modern Apartment Building Background */}
          <div className="w-80 h-48 bg-gradient-to-t from-gray-300 to-gray-100 rounded-lg relative mb-4 shadow-lg">
            {/* Building Windows */}
            <div className="absolute inset-4 grid grid-cols-6 gap-2">
              <div className="bg-indigo-200 bg-opacity-20 rounded-sm"></div>
              <div className="bg-yellow-200 bg-opacity-30 rounded-sm"></div>
              <div className="bg-white rounded-sm"></div>
              <div className="bg-indigo-200 bg-opacity-20 rounded-sm"></div>
              <div className="bg-yellow-200 bg-opacity-30 rounded-sm"></div>
              <div className="bg-white rounded-sm"></div>
              <div className="bg-white rounded-sm"></div>
              <div className="bg-indigo-200 bg-opacity-20 rounded-sm"></div>
              <div className="bg-yellow-200 bg-opacity-30 rounded-sm"></div>
              <div className="bg-white rounded-sm"></div>
              <div className="bg-indigo-200 bg-opacity-20 rounded-sm"></div>
              <div className="bg-yellow-200 bg-opacity-30 rounded-sm"></div>
              <div className="bg-yellow-200 bg-opacity-30 rounded-sm"></div>
              <div className="bg-white rounded-sm"></div>
              <div className="bg-indigo-200 bg-opacity-20 rounded-sm"></div>
              
              <div className="bg-yellow-200 bg-opacity-30 rounded-sm"></div>
              <div className="bg-white rounded-sm"></div>
              <div className="bg-indigo-200 bg-opacity-20 rounded-sm"></div>
            </div>
            {/* Building Entrance */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-20 bg-green-800 rounded-t-lg shadow-md"></div>
          </div>
          
          {/* Diverse Family Silhouettes */}
          <div className="flex items-end justify-center space-x-2 -mt-8 relative z-20">
            {/* Father */}
            <div className="w-12 h-16 bg-green-800 rounded-full relative">
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-amber-600 rounded-full"></div>
              <div className="absolute bottom-0 w-full h-10 bg-blue-600 rounded-b-full"></div>
            </div>
            {/* Mother */}
            <div className="w-10 h-14 bg-yellow-500 rounded-full relative">
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-amber-700 rounded-full"></div>
              <div className="absolute bottom-0 w-full h-8 bg-red-500 rounded-b-full"></div>
            </div>
            {/* Child 1 */}
            <div className="w-8 h-10 bg-orange-400 rounded-full relative">
              <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-amber-800 rounded-full"></div>
              <div className="absolute bottom-0 w-full h-6 bg-green-500 rounded-b-full"></div>
            </div>
            {/* Child 2 */}
            <div className="w-7 h-9 bg-purple-400 rounded-full relative">
              <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-amber-900 rounded-full"></div>
              <div className="absolute bottom-0 w-full h-5 bg-pink-500 rounded-b-full"></div>
            </div>
          </div>
        </div>
        
        {/* Welcome Text */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-3">Welcome to Lala Rente</h1>
          <p className="text-gray-600 text-lg leading-relaxed px-4">
            Your trusted partner for finding and managing rental properties across South Africa
          </p>
        </div>
        
        {/* Get Started Button */}
        <button 
          onClick={showPropertyDiscovery}
          className="bg-emerald-700 text-white px-10 py-4 rounded-lg font-semibold text-lg shadow-lg hover:bg-emerald-700 transition-colors mb-8"
        >
          Get Started
        </button>
        
        {/* Page Indicator Dots */}
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-green-600 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute top-10 right-10 w-6 h-6 bg-yellow-500 rounded-full opacity-60"></div>
      <div className="absolute top-32 left-8 w-4 h-4 bg-blue-500 rounded-full opacity-40"></div>
      <div className="absolute bottom-32 left-12 w-5 h-5 bg-yellow-500 rounded-full opacity-50"></div>
    </div>
  )
}
