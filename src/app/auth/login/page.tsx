'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { type UserRole } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('')
  const { signIn, isLoading, error, user, profile } = useAuthStore()
  const router = useRouter()

  // Redirect if already logged in
  useEffect(() => {
    if (user && profile) {
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
        default:
          router.push('/onboarding')
      }
    }
  }, [user, profile, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await signIn(email, password)
    
    if (result.success) {
      if (selectedRole) {
        const destination = selectedRole === 'admin' ? '/admin' : `/dashboard/${selectedRole}`
        router.push(destination)
        return
      }
      if (result.redirectTo) {
        router.push(result.redirectTo)
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-sa-gold-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">LR</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Lala Rente</h1>
          <p className="text-gray-600">Sign in to your account</p>
        </CardHeader>
        
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Login as (optional)</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole | '')}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sa-green-500 text-gray-900"
                disabled={isLoading}
              >
                <option value="">Choose role (auto-detect if empty)</option>
                <option value="tenant">Tenant</option>
                <option value="owner">Owner</option>
                <option value="vendor">Vendor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sa-green-500"
                required
                disabled={isLoading}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sa-green-500"
                required
                disabled={isLoading}
              />
            </div>
            
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
            Don&apos;t have an account??{' '}
              <a href="/auth/register" className="text-sa-green-500 hover:underline">
                Sign up
              </a>
            </p>
            <p className="text-sm text-gray-600 mt-2">
              <a href="/auth/forgot-password" className="text-sa-green-500 hover:underline">
                Forgot your password?
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
