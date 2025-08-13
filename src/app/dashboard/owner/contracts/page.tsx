'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase, type TablesInsert } from '@/lib/supabase'
import { compileTemplate } from '@/utils/template'
import { useSearchParams } from 'next/navigation'
import { useRef } from 'react'
import Link from 'next/link'

type ServiceContractLite = {
	id: string
	title: string
	status: string
	property_id: string
	requires_tenant_signature: boolean | null
}

type TenancyContractLite = {
	id: string
	title: string
	status: string
	property_id: string
	requires_owner_signature: boolean | null
	requires_tenant_signature: boolean | null
}

export default function OwnerContractsPage() {
	const { user } = useAuthStore()
  const params = useSearchParams()
	const [serviceContracts, setServiceContracts] = useState<ServiceContractLite[]>([])
	const [tenancyContracts, setTenancyContracts] = useState<TenancyContractLite[]>([])
	const [loading, setLoading] = useState(false)
	const [msg, setMsg] = useState('')
	const [newTenancy, setNewTenancy] = useState({ title: '', property_id: '', tenant_id: '' })
  const [templates, setTemplates] = useState<{ id: string; title: string; content_html: string }[]>([])
  const [templateId, setTemplateId] = useState('')
  const [previewHtml, setPreviewHtml] = useState('')
  const [ownerProperties, setOwnerProperties] = useState<{ id: string; title: string; address: string; status: string | null }[]>([])
  const [tenantName, setTenantName] = useState('')
  const [resolvedTenant, setResolvedTenant] = useState<{ id: string; full_name: string; email?: string | null } | null>(null)
  const formRef = useRef<HTMLDivElement | null>(null)

  const filter = (params.get('filter') || '').toLowerCase() // 'tenancy' | 'service' | ''
  const statusFilter = (params.get('status') || '').toLowerCase() // e.g. 'active'
  const openNew = (params.get('new') || '').toLowerCase() === 'tenancy'

	useEffect(() => {
		if (!user) return
		const load = async () => {
			try {
				const { data: svc } = await supabase
					.from('service_contracts')
					.select('id,title,status,property_id,requires_tenant_signature')
					.eq('owner_id', user.id)
					.order('created_at', { ascending: false })
				setServiceContracts(svc || [])

        let tenancyQuery = supabase
          .from('tenancy_contracts')
          .select('id,title,status,property_id,requires_owner_signature,requires_tenant_signature')
          .eq('owner_id', user.id)
        if (statusFilter) tenancyQuery = tenancyQuery.eq('status', statusFilter)
        const { data: tnc } = await tenancyQuery.order('created_at', { ascending: false })
				setTenancyContracts(tnc || [])

        // Load tenancy templates
        const { data: tpl } = await supabase
          .from('contract_templates' as never)
          .select('id,title,content_html')
          .eq('role_scope','tenancy')
          .eq('is_active', true)
        setTemplates(tpl || [])

        // Load owner's unoccupied properties (available or vacant)
        const { data: props } = await supabase
          .from('properties')
          .select('id,title,address,status')
          .eq('owner_id', user.id)
          .in('status', ['available','vacant'])
        setOwnerProperties(props || [])
			} catch {
				// ignore
			}
		}
		load()
  }, [user, statusFilter])

  // Scroll to creation form when requested
  useEffect(() => {
    if (openNew && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [openNew])

  // Update preview when template or title changes
  useEffect(() => {
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) { setPreviewHtml(''); return }
    const context: Record<string, unknown> = {
      contract: { title: newTenancy.title },
      owner: { full_name: 'Owner' },
      tenant: { full_name: 'Tenant' },
      property: { address: 'Address', city: 'City', rent_amount: '' },
      lease: { lease_start: '', lease_end: '' },
      date: { today: new Date().toISOString().slice(0,10) },
    }
    setPreviewHtml(compileTemplate(tpl.content_html, context))
  }, [templateId, templates, newTenancy.title])

	const createTenancyContract = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!user) return
		setLoading(true)
		setMsg('')
    try {
      const payload: TablesInsert<'tenancy_contracts'> = {
				owner_id: user.id,
				property_id: newTenancy.property_id.trim(),
				tenant_id: newTenancy.tenant_id.trim(),
				title: newTenancy.title.trim(),
        status: 'pending_signatures',
				requires_owner_signature: true,
				requires_tenant_signature: true,
			}
      const { error } = await supabase.from('tenancy_contracts').insert(payload)
			if (error) throw error
			setNewTenancy({ title: '', property_id: '', tenant_id: '' })
			const { data: tnc } = await supabase
				.from('tenancy_contracts')
				.select('id,title,status,property_id,requires_owner_signature,requires_tenant_signature')
				.eq('owner_id', user.id)
				.order('created_at', { ascending: false })
			setTenancyContracts(tnc || [])
			setMsg('Tenancy contract created')
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create tenancy contract'
			setMsg(message)
		} finally {
			setLoading(false)
		}
	}

	const signServiceContractAsOwner = async (contractId: string, file: File | null) => {
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
			const { error: insertError } = await supabase
				.from('service_contract_signatures')
				.insert({
					contract_id: contractId,
					signer_role: 'owner',
					signer_id: user.id,
					signature_image_url: signatureUrl || 'uploaded-in-external-system',
					signed_at: new Date().toISOString(),
				})
			if (insertError) throw insertError
      await updateServiceStatusIfComplete(contractId)
      setMsg('Signed successfully')
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to sign'
			setMsg(message)
		} finally {
			setLoading(false)
		}
	}

	const signTenancyContractAsOwner = async (contractId: string, file: File | null) => {
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
			const { error: insertError } = await supabase
				.from('tenancy_contract_signatures')
				.insert({
					contract_id: contractId,
					signer_role: 'owner',
					signer_id: user.id,
					signature_image_url: signatureUrl || 'uploaded-in-external-system',
					signed_at: new Date().toISOString(),
				})
			if (insertError) throw insertError
      await updateTenancyStatusIfComplete(contractId)
      setMsg('Signed successfully')
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to sign'
			setMsg(message)
		} finally {
			setLoading(false)
		}

	}

	const updateServiceStatusIfComplete = async (contractId: string) => {
    try {
      const { data: contract } = await supabase
        .from('service_contracts')
        .select('requires_tenant_signature')
        .eq('id', contractId)
        .maybeSingle()
      const { data: sigs } = await supabase
        .from('service_contract_signatures')
        .select('signer_role')
        .eq('contract_id', contractId)
      const hasOwner = !!sigs?.some(s => s.signer_role === 'owner')
      const hasVendor = !!sigs?.some(s => s.signer_role === 'vendor')
      const hasTenant = !!sigs?.some(s => s.signer_role === 'tenant')
      const tenantRequired = !!contract?.requires_tenant_signature
      if (hasOwner && hasVendor && (!tenantRequired || hasTenant)) {
        await supabase.from('service_contracts').update({ status: 'active' }).eq('id', contractId)
      }
    } catch {
      // ignore
    }
  }

		const resolveTenantByName = async () => {
    setMsg('')
    setResolvedTenant(null)
    try {
      if (!tenantName || tenantName.length < 3) {
        setMsg('Enter at least 3 characters of tenant name')
        return
      }
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const res = await (supabase as any).rpc('search_tenants_by_name', { q: tenantName })
				if (res.error) throw res.error
				const list = Array.isArray(res.data) ? (res.data as { id: string; full_name: string }[]) : []
				if (list.length === 0) {
        setMsg('No tenant found for that name')
        return
      }
				const first = list[0]
      setResolvedTenant({ id: first.id, full_name: first.full_name })
      setNewTenancy(s => ({ ...s, tenant_id: first.id }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resolve tenant by name'
      setMsg(message)
    }
  }

	const updateTenancyStatusIfComplete = async (contractId: string) => {
    try {
      const { data: contract } = await supabase
        .from('tenancy_contracts')
        .select('requires_owner_signature,requires_tenant_signature')
        .eq('id', contractId)
        .maybeSingle()
      const { data: sigs } = await supabase
        .from('tenancy_contract_signatures')
        .select('signer_role')
        .eq('contract_id', contractId)
      const hasOwner = !!sigs?.some(s => s.signer_role === 'owner')
      const hasTenant = !!sigs?.some(s => s.signer_role === 'tenant')
      const ownerRequired = contract?.requires_owner_signature !== false
      const tenantRequired = contract?.requires_tenant_signature !== false
      if ((ownerRequired ? hasOwner : true) && (tenantRequired ? hasTenant : true)) {
        await supabase.from('tenancy_contracts').update({ status: 'active' }).eq('id', contractId)
      }
    } catch {
      // ignore
    }
  }
  return (
		<ProtectedRoute allowedRoles={['owner']}>
			<div className="p-4 max-w-5xl mx-auto">
				<h1 className="text-2xl font-bold mb-4">Contracts Requiring Your Attention</h1>
				{msg && (
					<div className="mb-4 p-3 rounded border border-gray-200 bg-gray-50 text-gray-700">{msg}</div>
				)}

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filter !== 'tenancy' && (
          <div className="border rounded-lg p-4">
						<h2 className="font-semibold mb-3">Service Contracts</h2>
						<ul className="divide-y">
							{serviceContracts.map((c) => (
                        <li key={c.id} className="py-3">
                            <div className="font-medium"><Link href={`/contracts?id=${c.id}`} className="text-sa-blue-600 underline">{c.title}</Link></div>
									<div className="text-sm text-gray-600">Status: {c.status} · Property: {c.property_id}</div>
									<div className="mt-2 flex items-center gap-2">
										<label className="text-sm text-gray-700">Signature (PNG/JPG)</label>
										<input type="file" accept="image/*" onChange={(e)=> signServiceContractAsOwner(c.id, e.target.files?.[0] || null)} />
									</div>
								</li>
							))}
							{serviceContracts.length===0 && <li className="py-2 text-sm text-gray-500">No service contracts pending.</li>}
						</ul>
          </div>
          )}

          {filter !== 'service' && (
          <div className="border rounded-lg p-4" ref={formRef}>
						<h2 className="font-semibold mb-3">Tenancy Contracts</h2>
            {templates.length > 0 && (
              <div className="mb-4 space-y-2">
                <label className="text-sm text-gray-700">Template</label>
                <select className="w-full border rounded px-3 py-2" value={templateId} onChange={(e)=> setTemplateId(e.target.value)}>
                  <option value="">No template</option>
                  {templates.map(t=> (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                {previewHtml && (
                  <div className="border rounded p-3 bg-white">
                    <div className="text-sm font-semibold mb-2 text-gray-900">Preview</div>
                    <div className="prose max-w-none [&_*]:text-gray-900" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                )}
              </div>
            )}
            <form onSubmit={createTenancyContract} className="space-y-3 mb-4">
              <input className="w-full border rounded px-3 py-2" placeholder="Title" value={newTenancy.title} onChange={(e)=>setNewTenancy(s=>({...s,title:e.target.value}))} required />
              <div>
                <label className="text-sm text-gray-700">Property</label>
                <select className="w-full border rounded px-3 py-2 mt-1" value={newTenancy.property_id} onChange={(e)=>setNewTenancy(s=>({...s,property_id:e.target.value}))} required>
                  <option value="">Select property</option>
                  {ownerProperties.map(p => (
                    <option key={p.id} value={p.id}>{p.title} – {p.address}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-700">Tenant (search by name)</label>
                <div className="flex gap-2 mt-1">
                  <input className="flex-1 border rounded px-3 py-2" placeholder="Enter tenant name" value={tenantName} onChange={(e)=>setTenantName(e.target.value)} />
                  <button type="button" onClick={resolveTenantByName} className="px-3 py-2 border rounded">Resolve</button>
                </div>
                {resolvedTenant && (
                  <div className="text-sm text-gray-700 mt-1">Selected: {resolvedTenant.full_name}</div>
                )}
              </div>
							<button disabled={loading} className="bg-sa-blue-500 text-white px-4 py-2 rounded disabled:opacity-50">{loading ? 'Creating...' : 'Create Tenancy Contract'}</button>
						</form>
						<ul className="divide-y">
              {tenancyContracts
                .filter(c => (statusFilter ? c.status === statusFilter : true))
                .map((c) => (
                        <li key={c.id} className="py-3">
                            <div className="font-medium"><Link href={`/contracts?id=${c.id}`} className="text-sa-blue-600 underline">{c.title}</Link></div>
									<div className="text-sm text-gray-600">Status: {c.status} · Property: {c.property_id}</div>
									<div className="mt-2 flex items-center gap-2">
										<label className="text-sm text-gray-700">Signature (PNG/JPG)</label>
										<input type="file" accept="image/*" onChange={(e)=> signTenancyContractAsOwner(c.id, e.target.files?.[0] || null)} />
									</div>
								</li>
              ))}
							{tenancyContracts.length===0 && <li className="py-2 text-sm text-gray-500">No tenancy contracts pending.</li>}
						</ul>
					</div>
          )}
				</div>
			</div>
		</ProtectedRoute>
	)
}


