'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type ServiceContractLite = {
	id: string
	title: string
	status: string
	property_id: string
}

type TenancyContractLite = {
	id: string
	title: string
	status: string
	property_id: string
}

export default function TenantContractsPage() {
	const { user } = useAuthStore()
	const [serviceContracts, setServiceContracts] = useState<ServiceContractLite[]>([])
	const [tenancyContracts, setTenancyContracts] = useState<TenancyContractLite[]>([])
  const [loading, setLoading] = useState(false) // kept for future UX; suppress unused warning by using it
	const [msg, setMsg] = useState('')

	useEffect(() => {
		if (!user) return
		const load = async () => {
			try {
				const { data: svc } = await supabase
					.from('service_contracts')
					.select('id,title,status,property_id')
					.eq('tenant_id', user.id)
					.order('created_at', { ascending: false })
				setServiceContracts(svc || [])

				const { data: tnc } = await supabase
					.from('tenancy_contracts')
					.select('id,title,status,property_id')
					.eq('tenant_id', user.id)
					.order('created_at', { ascending: false })
				setTenancyContracts(tnc || [])
			} catch {
				// ignore
			}
		}
		load()
	}, [user])

	const signServiceContractAsTenant = async (contractId: string, file: File | null) => {
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
					signer_role: 'tenant',
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

	const signTenancyContractAsTenant = async (contractId: string, file: File | null) => {
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
					signer_role: 'tenant',
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
		<ProtectedRoute allowedRoles={['tenant']}>
			<div className="p-4 max-w-5xl mx-auto">
				<h1 className="text-2xl font-bold mb-4">Contracts Requiring Your Signature</h1>
				{msg && (
					<div className="mb-4 p-3 rounded border border-gray-200 bg-gray-50 text-gray-700">{msg}</div>
				)}

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div className="border rounded-lg p-4">
						<h2 className="font-semibold mb-3">Service Contracts</h2>
						<ul className="divide-y">
							{serviceContracts.map((c) => (
                        <li key={c.id} className="py-3">
                            <div className="font-medium"><Link href={`/contracts?id=${c.id}`} className="text-sa-blue-600 underline">{c.title}</Link></div>
									<div className="text-sm text-gray-600">Status: {c.status} · Property: {c.property_id}</div>
									<div className="mt-2 flex items-center gap-2">
										<label className="text-sm text-gray-700">Signature (PNG/JPG)</label>
										<input type="file" accept="image/*" onChange={(e)=> signServiceContractAsTenant(c.id, e.target.files?.[0] || null)} />
									</div>
								</li>
							))}
							{serviceContracts.length===0 && <li className="py-2 text-sm text-gray-500">No service contracts pending.</li>}
						</ul>
					</div>

					<div className="border rounded-lg p-4">
						<h2 className="font-semibold mb-3">Tenancy Contracts</h2>
						<ul className="divide-y">
							{tenancyContracts.map((c) => (
                        <li key={c.id} className="py-3">
                            <div className="font-medium"><Link href={`/contracts?id=${c.id}`} className="text-sa-blue-600 underline">{c.title}</Link></div>
									<div className="text-sm text-gray-600">Status: {c.status} · Property: {c.property_id}</div>
									<div className="mt-2 flex items-center gap-2">
										<label className="text-sm text-gray-700">Signature (PNG/JPG)</label>
										<input type="file" accept="image/*" onChange={(e)=> signTenancyContractAsTenant(c.id, e.target.files?.[0] || null)} />
									</div>
								</li>
							))}
							{tenancyContracts.length===0 && <li className="py-2 text-sm text-gray-500">No tenancy contracts pending.</li>}
						</ul>
					</div>
				</div>
			</div>
		</ProtectedRoute>
	)
}


