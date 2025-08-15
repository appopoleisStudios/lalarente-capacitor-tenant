'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import BottomNavbar from '@/components/BottomNavbar'
import { useAuthStore } from '@/store/authStore'

export default function OwnerProfilePage() {
  const { profile, signOut } = useAuthStore()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div className="max-w-sm mx-auto bg-white min-h-screen pb-20">
        <div className="px-4 py-4 border-b">
          <h1 className="font-semibold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500">{profile?.email}</p>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600">Full Name</div>
            <div className="text-gray-900 font-medium">{profile?.full_name || 'Owner'}</div>
          </div>

          <button
            data-testid="owner-signout"
            onClick={handleSignOut}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium"
          >
            Sign out
          </button>
        </div>

        <BottomNavbar userRole="owner" />
      </div>
    </ProtectedRoute>
  )
}


