'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function TenantDashboardPage() {
  const router = useRouter()
  const { user, profile } = useAuthStore()

  return (
    <ProtectedRoute allowedRoles={['tenant']}>
      <div className="max-w-md mx-auto min-h-screen shadow-xl bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-12 w-16 h-16 border border-green-600 rounded-full"></div>
          <div className="absolute bottom-40 right-8 w-20 h-20 border border-yellow-500 rounded-full"></div>
          <div className="absolute top-1/3 right-6 w-12 h-12 border border-blue-600 rounded-full"></div>
        </div>
        
        {/* Header */}
        <div className="bg-white shadow-sm p-4 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-800">Tenant Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome back, {profile?.full_name}</p>
            </div>
            <div className="relative">
              <button className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
                <i className="fas fa-bell text-gray-600"></i>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">2</span>
                </div>
              </button>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="p-6 relative z-10">
          {/* Welcome Section */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-6 text-white mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold mb-2">Welcome to Lala Rente</h2>
                <p className="text-green-100 text-sm">
                  Find your perfect rental home with ease.
                </p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <i className="fas fa-home text-xl"></i>
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
                ? 'Your account has been verified. You can now apply for rental properties.'
                : 'We are reviewing your documents. This usually takes 1-2 business days.'
              }
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button 
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="text-center">
                <i className="fas fa-search text-green-600 text-2xl mb-2"></i>
                <p className="text-sm font-medium text-gray-800">Find Properties</p>
              </div>
            </button>
            
            <button 
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="text-center">
                <i className="fas fa-file-alt text-blue-600 text-2xl mb-2"></i>
                <p className="text-sm font-medium text-gray-800">My Applications</p>
              </div>
            </button>
            
            <button 
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="text-center">
                <i className="fas fa-heart text-red-600 text-2xl mb-2"></i>
                <p className="text-sm font-medium text-gray-800">Favorites</p>
              </div>
            </button>
            
            <button 
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="text-center">
                <i className="fas fa-cog text-gray-600 text-2xl mb-2"></i>
                <p className="text-sm font-medium text-gray-800">Settings</p>
              </div>
            </button>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-sm text-gray-600">Account created successfully</p>
                <span className="text-xs text-gray-400 ml-auto">Just now</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <p className="text-sm text-gray-600">Document uploaded</p>
                <span className="text-xs text-gray-400 ml-auto">Just now</span>
              </div>
            </div>
          </div>

          {/* Sign Out */}
          <button 
            onClick={() => {
              // Add sign out logic here
              router.push('/auth/login')
            }}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-500 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </ProtectedRoute>
  )
} 