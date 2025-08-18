'use client'

import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase, type Profile } from '@/lib/supabase'

export default function OnboardingUserTypePage() {
  const { profile } = useAuthStore()
  const [msg, setMsg] = useState('')
  const role = profile?.role
  const [ownerKyc, setOwnerKyc] = useState(false)
  const [ownerProperty, setOwnerProperty] = useState(false)
  const [vendorServices, setVendorServices] = useState(false)
  const [vendorArea, setVendorArea] = useState(false)
  const [vendorKyc, setVendorKyc] = useState(false)
  const [tenantProfile, setTenantProfile] = useState(false)
  const [tenantVerify, setTenantVerify] = useState(false)

  const canComplete = useMemo(() => {
    if (!role) return false
    if (role === 'owner') return ownerKyc && ownerProperty
    if (role === 'vendor') return vendorServices && vendorArea && vendorKyc
    if (role === 'tenant') return tenantProfile && tenantVerify
    return false
  }, [role, ownerKyc, ownerProperty, vendorServices, vendorArea, vendorKyc, tenantProfile, tenantVerify])

  const markDone = async () => {
    try {
      if (!profile) return
      const flags: Record<string, boolean> = {}
      if (profile.role === 'owner') flags.onboarding_owner_done = true
      if (profile.role === 'tenant') flags.onboarding_tenant_done = true
      if (profile.role === 'vendor') flags.onboarding_vendor_done = true
      if (Object.keys(flags).length === 0) return
      const { error } = await supabase.from('profiles').update(flags).eq('id', profile.id)
      if (error) throw error
      setMsg('Onboarding completed. Redirecting...')
      const target = profile.role === 'owner' ? '/dashboard/owner' : profile.role === 'tenant' ? '/dashboard/tenant' : '/dashboard/vendor'
      window.location.href = target
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  type OnboardingProfile = Profile & { onboarding_owner_done?: boolean; onboarding_tenant_done?: boolean; onboarding_vendor_done?: boolean }

  useEffect(() => {
    // Auto-redirect if already completed
    if (!profile) return
    const p = profile as unknown as OnboardingProfile
    if ((profile.role === 'owner' && p.onboarding_owner_done) ||
        (profile.role === 'tenant' && p.onboarding_tenant_done) ||
        (profile.role === 'vendor' && p.onboarding_vendor_done)) {
      const target = profile.role === 'owner' ? '/dashboard/owner' : profile.role === 'tenant' ? '/dashboard/tenant' : '/dashboard/vendor'
      window.location.href = target
    }
  }, [profile])

  return (
    <ProtectedRoute>
      <div className="max-w-sm mx-auto p-4 min-h-screen bg-white">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Getting Started</h1>
        <p className="text-sm text-gray-600 mb-4">Complete the steps for your role to continue.</p>

        {role === 'owner' && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <div className="text-sm font-medium text-blue-800 mb-2">Owner onboarding</div>
            <label className="flex items-center gap-2 text-sm text-gray-800 mb-2">
              <input type="checkbox" checked={ownerKyc} onChange={(e)=>setOwnerKyc(e.target.checked)} /> Verify KYC documents
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={ownerProperty} onChange={(e)=>setOwnerProperty(e.target.checked)} /> Add first property
            </label>
                  </div>
        )}

        {role === 'vendor' && (
          <div className="bg-indigo-50 rounded-lg p-4 mb-4">
            <div className="text-sm font-medium text-indigo-800 mb-2">Vendor onboarding</div>
            <label className="flex items-center gap-2 text-sm text-gray-800 mb-2">
              <input type="checkbox" checked={vendorServices} onChange={(e)=>setVendorServices(e.target.checked)} /> Add at least 1 service
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800 mb-2">
              <input type="checkbox" checked={vendorArea} onChange={(e)=>setVendorArea(e.target.checked)} /> Set service area & availability
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={vendorKyc} onChange={(e)=>setVendorKyc(e.target.checked)} /> Upload KYC documents
            </label>
              </div>
        )}

        {role === 'tenant' && (
          <div className="bg-emerald-50 rounded-lg p-4 mb-4">
            <div className="text-sm font-medium text-emerald-800 mb-2">Tenant onboarding</div>
            <label className="flex items-center gap-2 text-sm text-gray-800 mb-2">
              <input type="checkbox" checked={tenantProfile} onChange={(e)=>setTenantProfile(e.target.checked)} /> Complete profile details
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={tenantVerify} onChange={(e)=>setTenantVerify(e.target.checked)} /> Verify phone/ID
            </label>
                    </div>
        )}

        {msg && <div className="mb-3 text-sm text-gray-700">{msg}</div>}
        <button onClick={markDone} disabled={!canComplete} className={`w-full ${canComplete ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-300 cursor-not-allowed'} text-white py-2 rounded-lg font-medium`} data-testid="onboarding-mark-done">Mark Onboarding Done</button>
                  </div>
    </ProtectedRoute>
  )
}
