'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function UnauthorizedPage() {
  const router = useRouter()
  const { user, profile } = useAuthStore()

  const goBack = () => {
    router.back()
  }

  const goHome = () => {
    router.push('/')
  }

  const goToLogin = () => {
    router.push('/auth/login')
  }

  return (
    <div className="max-w-md mx-auto min-h-screen shadow-xl bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-12 w-16 h-16 border border-red-600 rounded-full"></div>
        <div className="absolute bottom-40 right-8 w-20 h-20 border border-yellow-500 rounded-full"></div>
        <div className="absolute top-1/3 right-6 w-12 h-12 border border-blue-600 rounded-full"></div>
      </div>
      
      {/* Main Content */}
      <div className="p-6 relative z-10 flex flex-col items-center justify-center min-h-screen">
        {/* Icon */}
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <i className="fas fa-exclamation-triangle text-red-600 text-3xl"></i>
        </div>
        
        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-800 mb-4 text-center">
          Access Denied
        </h1>
        
        {/* Message */}
        <div className="text-center mb-8">
          <p className="text-gray-600 mb-2">
            You don&apos;t have permission to access this page.
          </p>
          {profile && (
            <p className="text-sm text-gray-500">
              Your account type: <span className="font-medium capitalize">{profile.role}</span>
            </p>
          )}
        </div>
        
        {/* Actions */}
        <div className="space-y-3 w-full">
          <button
            onClick={goBack}
            className="w-full bg-gray-800 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
          >
            Go Back
          </button>
          
          <button
            onClick={goHome}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-500 transition-colors"
          >
            Go to Home
          </button>
          
          {!user && (
            <button
              onClick={goToLogin}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-500 transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  )
} 