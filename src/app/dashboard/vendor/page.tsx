'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type NewServiceForm = {
  title: string
  description: string
  base_price: string
  pricing_unit: string
}

type NewContractForm = {
  property_id: string
  owner_id: string
  tenant_id?: string
  title: string
}

export default function VendorDashboardPage() {
  const { user, signOut } = useAuthStore()
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabase

  type VendorService = { id: string; title?: string; description?: string | null; base_price?: number | null; pricing_unit?: string | null }
  type ServiceContract = { id: string; title?: string; status?: string; property_id?: string }
  const [services, setServices] = useState<VendorService[]>([])
  const [contracts, setContracts] = useState<ServiceContract[]>([])
  const [serviceForm, setServiceForm] = useState<NewServiceForm>({ title: '', description: '', base_price: '', pricing_unit: '' })
  const [contractForm, setContractForm] = useState<NewContractForm>({ property_id: '', owner_id: '', tenant_id: '', title: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string>('')

  // vendor-only route enforced by ProtectedRoute

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const { data: svc } = await sb.from('vendor_services' as string).select('id,title,description,base_price,pricing_unit').eq('vendor_id', user.id).order('created_at', { ascending: false })
        setServices(svc || [])
        const { data: ctr } = await sb.from('service_contracts' as string).select('id,title,status,property_id').eq('vendor_id', user.id).order('created_at', { ascending: false })
        setContracts(ctr || [])
      } catch {
        // ignore for scaffold
      }
    }
    load()
  }, [user, sb])

  const createService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setMsg('')
    try {
      const basePrice = parseFloat(serviceForm.base_price || '0')
      const { error } = await sb.from('vendor_services' as string).insert({
        vendor_id: user.id,
        title: serviceForm.title.trim(),
        description: serviceForm.description.trim() || null,
        base_price: isNaN(basePrice) ? 0 : basePrice,
        pricing_unit: serviceForm.pricing_unit.trim() || null,
      })
      if (error) throw error
      setServiceForm({ title: '', description: '', base_price: '', pricing_unit: '' })
      const { data: svc } = await sb.from('vendor_services' as string).select('*').eq('vendor_id', user.id).order('created_at', { ascending: false })
      setServices(svc || [])
      setMsg('Service created')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create service'
      setMsg(message)
    } finally {
      setLoading(false)
    }
  }

  const createContract = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setMsg('')
    try {
      const payload = {
        vendor_id: user.id,
        property_id: contractForm.property_id.trim(),
        owner_id: contractForm.owner_id.trim(),
        title: contractForm.title.trim(),
        status: 'pending_signatures',
      }
      const withTenant = contractForm.tenant_id && contractForm.tenant_id.trim() ? { ...payload, tenant_id: contractForm.tenant_id.trim() } : payload
      const { error } = await sb.from('service_contracts' as string).insert(withTenant as unknown as Record<string, unknown>)
      if (error) throw error
      setContractForm({ property_id: '', owner_id: '', tenant_id: '', title: '' })
      const { data: ctr } = await sb.from('service_contracts' as string).select('*').eq('vendor_id', user.id).order('created_at', { ascending: false })
      setContracts(ctr || [])
      setMsg('Contract created')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create contract'
      setMsg(message)
    } finally {
      setLoading(false)
    }
  }

  const signContractAsVendor = async (contractId: string, file: File | null) => {
    if (!user) return
    setLoading(true)
    setMsg('')
    try {
      let signatureUrl: string | null = null
      if (file) {
        const path = `signatures/${contractId}/${user.id}-${Date.now()}-${file.name}`
        const { data, error } = await supabase.storage.from('contracts').upload(path, file, { upsert: true })
        if (error) throw error
        signatureUrl = data?.path || path
      }
      const { error: insertError } = await sb.from('service_contract_signatures' as string).insert({
        contract_id: contractId,
        signer_role: 'vendor',
        signer_id: user.id,
        signature_image_url: signatureUrl || 'uploaded-in-external-system',
        signed_at: new Date().toISOString(),
      })
      if (insertError) throw insertError
      setMsg('Signed successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign'
      setMsg(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['vendor']}>
      <div className="p-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Vendor Dashboard</h1>
          <button
            onClick={async ()=>{ await signOut(); router.push('/auth/login') }}
            className="text-sm px-3 py-2 rounded border border-gray-200 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
        {msg && (
          <div className="mb-4 p-3 rounded border border-gray-200 bg-gray-50 text-gray-700">{msg}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-lg p-4">
            <h2 className="font-semibold mb-3">Your Services</h2>
            <form onSubmit={createService} className="space-y-3 mb-4">
              <input className="w-full border rounded px-3 py-2" placeholder="Title" value={serviceForm.title} onChange={(e)=>setServiceForm(s=>({...s,title:e.target.value}))} required />
              <textarea className="w-full border rounded px-3 py-2" placeholder="Description (optional)" value={serviceForm.description} onChange={(e)=>setServiceForm(s=>({...s,description:e.target.value}))} />
              <div className="flex gap-3">
                <input className="flex-1 border rounded px-3 py-2" placeholder="Base price (e.g., 500)" value={serviceForm.base_price} onChange={(e)=>setServiceForm(s=>({...s,base_price:e.target.value}))} />
                <input className="flex-1 border rounded px-3 py-2" placeholder="Pricing unit (e.g., per visit)" value={serviceForm.pricing_unit} onChange={(e)=>setServiceForm(s=>({...s,pricing_unit:e.target.value}))} />
              </div>
              <button disabled={loading} className="bg-sa-green-500 text-white px-4 py-2 rounded disabled:opacity-50">{loading ? 'Saving...' : 'Add Service'}</button>
            </form>

            <ul className="divide-y">
              {services.map((svc)=> (
                <li key={svc.id} className="py-2">
                  <div className="font-medium">{svc.title}</div>
                  <div className="text-sm text-gray-600">{svc.description || 'No description'} · {svc.base_price ? `R ${svc.base_price}` : 'No price' } {svc.pricing_unit ? `(${svc.pricing_unit})` : ''}</div>
                </li>
              ))}
              {services.length===0 && <li className="py-2 text-sm text-gray-500">No services yet.</li>}
            </ul>
          </div>

          <div className="border rounded-lg p-4">
            <h2 className="font-semibold mb-3">Service Contracts</h2>
            <form onSubmit={createContract} className="space-y-3 mb-4">
              <input className="w-full border rounded px-3 py-2" placeholder="Title" value={contractForm.title} onChange={(e)=>setContractForm(s=>({...s,title:e.target.value}))} required />
              <input className="w-full border rounded px-3 py-2" placeholder="Owner ID (UUID)" value={contractForm.owner_id} onChange={(e)=>setContractForm(s=>({...s,owner_id:e.target.value}))} required />
              <input className="w-full border rounded px-3 py-2" placeholder="Property ID (UUID)" value={contractForm.property_id} onChange={(e)=>setContractForm(s=>({...s,property_id:e.target.value}))} required />
              <input className="w-full border rounded px-3 py-2" placeholder="Tenant ID (UUID, optional)" value={contractForm.tenant_id} onChange={(e)=>setContractForm(s=>({...s,tenant_id:e.target.value}))} />
              <button disabled={loading} className="bg-sa-blue-500 text-white px-4 py-2 rounded disabled:opacity-50">{loading ? 'Creating...' : 'Create Contract'}</button>
            </form>

            <ul className="divide-y">
              {contracts.map((c)=> (
                <li key={c.id} className="py-3">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-sm text-gray-600">Status: {c.status} · Property: {c.property_id}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-sm text-gray-700">Signature (PNG/JPG)</label>
                    <input type="file" accept="image/*" onChange={(e)=> signContractAsVendor(c.id, e.target.files?.[0] || null)} />
                  </div>
                </li>
              ))}
              {contracts.length===0 && <li className="py-2 text-sm text-gray-500">No contracts yet.</li>}
            </ul>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}


