'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { validatePasswordStrength } from '@/utils/password'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'updating' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    // Supabase sends an access token via the reset link; this page just collects new password
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setMessage('Passwords do not match')
      setStatus('error')
      return
    }
    const pw = validatePasswordStrength(password)
    if (!pw.isValid) {
      setMessage(pw.message || 'Weak password')
      setStatus('error')
      return
    }
    try {
      setStatus('updating')
      setMessage('')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setStatus('done')
      setMessage('Password updated successfully. You can now sign in.')
      setTimeout(() => router.push('/auth/login'), 1500)
    } catch (err: unknown) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Failed to update password')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-sa-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">LR</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
          <p className="text-gray-600">Enter your new password</p>
        </CardHeader>
        <CardContent>
          {message && (
            <div className={`mb-4 p-3 rounded-lg border ${status === 'error' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-green-50 border-green-200 text-green-700'}`}>
              {message}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sa-green-500 text-gray-900 placeholder-gray-500"
                required
                disabled={status === 'updating'}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sa-green-500 text-gray-900 placeholder-gray-500"
                required
                disabled={status === 'updating'}
              />
            </div>
            <Button type="submit" disabled={status === 'updating'} className="w-full">
              {status === 'updating' ? 'Updating...' : 'Update password'}
            </Button>
            <div className="mt-2 text-center">
              <a href="/auth/login" className="text-sm text-sa-green-500 hover:underline">Back to login</a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


