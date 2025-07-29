'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function OwnerDashboardPage() {
  const router = useRouter()
  const { user, profile, isLoading, isInitialized } = useAuthStore()

  useEffect(() => {
    if (isInitialized && !isLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, isLoading, isInitialized, router])

  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-3xl text-blue-600 mb-4"></i>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div className="max-w-md mx-auto min-h-screen shadow-xl bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-12 w-16 h-16 border border-blue-600 rounded-full"></div>
          <div className="absolute bottom-40 right-8 w-20 h-20 border border-yellow-500 rounded-full"></div>
          <div className="absolute top-1/3 right-6 w-12 h-12 border border-green-600 rounded-full"></div>
        </div>
        
        {/* Header */}
        <div className="bg-white shadow-sm p-4 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-800">Owner Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome back, {profile?.full_name}</p>
            </div>
            <div className="relative">
              <button className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
                <i className="fas fa-bell text-gray-600"></i>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">3</span>
                </div>
              </button>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="p-6 relative z-10">
          {/* Welcome Section */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold mb-2">Welcome to Lala Rente</h2>
                <p className="text-blue-100 text-sm">
                  Your account is being verified. You'll be able to list properties soon.
                </p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <i className="fas fa-building text-xl"></i>
              </div>
            </div>
          </div>

          {/* Verification Status */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">Account Verification</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                profile?.verification_status 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {profile?.verification_status ? 'Verified' : 'Pending'}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {profile?.verification_status 
                ? 'Your account has been verified. You can now list and manage properties.'
                : 'We are reviewing your documents. This usually takes 1-2 business days.'
              }
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button 
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center hover:shadow-md transition-shadow"
              onClick={() => router.push('/dashboard/owner/properties')}
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <i className="fas fa-home text-blue-600"></i>
              </div>
              <p className="text-sm font-medium text-gray-800">My Properties</p>
              <p className="text-xs text-gray-500">Manage listings</p>
            </button>
            
            <button 
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center hover:shadow-md transition-shadow"
              onClick={() => router.push('/dashboard/owner/analytics')}
            >
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <i className="fas fa-chart-line text-green-600"></i>
              </div>
              <p className="text-sm font-medium text-gray-800">Analytics</p>
              <p className="text-xs text-gray-500">View insights</p>
            </button>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-user-check text-blue-600 text-xs"></i>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">Account Created</p>
                  <p className="text-xs text-gray-500">Your owner account was successfully created</p>
                </div>
                <span className="text-xs text-gray-400">Just now</span>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-clock text-yellow-600 text-xs"></i>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">Verification Pending</p>
                  <p className="text-xs text-gray-500">Documents submitted for review</p>
                </div>
                <span className="text-xs text-gray-400">Just now</span>
              </div>
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-md mx-auto">
            <div className="flex justify-around">
              <button className="flex flex-col items-center space-y-1 text-blue-600">
                <i className="fas fa-home text-lg"></i>
                <span className="text-xs">Dashboard</span>
              </button>
              <button 
                className="flex flex-col items-center space-y-1 text-gray-400 hover:text-gray-600"
                onClick={() => router.push('/dashboard/owner/properties')}
              >
                <i className="fas fa-building text-lg"></i>
                <span className="text-xs">Properties</span>
              </button>
              <button 
                className="flex flex-col items-center space-y-1 text-gray-400 hover:text-gray-600"
                onClick={() => router.push('/dashboard/owner/payments')}
              >
                <i className="fas fa-credit-card text-lg"></i>
                <span className="text-xs">Payments</span>
              </button>
              <button 
                className="flex flex-col items-center space-y-1 text-gray-400 hover:text-gray-600"
                onClick={() => router.push('/dashboard/owner/profile')}
              >
                <i className="fas fa-user text-lg"></i>
                <span className="text-xs">Profile</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
} 