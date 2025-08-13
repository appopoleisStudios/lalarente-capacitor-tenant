'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

type ServiceContract = {
	id: string
	title: string
	status: string
	property_id: string
	owner_id: string
	vendor_id: string
	tenant_id: string | null
	pdf_url: string | null
	pdf_sha256: string | null
}

type TenancyContract = {
	id: string
	title: string
	status: string
	property_id: string
	owner_id: string
	tenant_id: string
	lease_id: string | null
	pdf_url: string | null
	pdf_sha256: string | null
}

export default function ContractDetailPage() {
	const params = useSearchParams()
	const contractId = params.get('id') || ''
	const [serviceContract, setServiceContract] = useState<ServiceContract | null>(null)
	const [tenancyContract, setTenancyContract] = useState<TenancyContract | null>(null)
	const [loading, setLoading] = useState(false)
	const [msg, setMsg] = useState('')

	useEffect(() => {
		if (!contractId) return
		const load = async () => {
			setLoading(true)
			setMsg('')
    try {
				const { data: svc } = await supabase.from('service_contracts').select('*').eq('id', contractId).maybeSingle()
				if (svc) {
					setServiceContract(svc as unknown as ServiceContract)
					setTenancyContract(null)
					setLoading(false)
					return
				}
				const { data: tnc } = await supabase.from('tenancy_contracts').select('*').eq('id', contractId).maybeSingle()
				if (tnc) {
					setTenancyContract(tnc as unknown as TenancyContract)
					setServiceContract(null)
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Failed to load contract'
				setMsg(message)
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [contractId])

  const contract = serviceContract || tenancyContract
  const isService = !!serviceContract
  const { profile } = useAuthStore()

	return (
    <div className={`p-4 max-w-3xl mx-auto ${profile?.role === 'owner' ? 'bg-gradient-to-b from-blue-50 to-white' : profile?.role === 'tenant' ? 'bg-gradient-to-b from-green-50 to-white' : ''}`}>
      <h1 className={`text-2xl font-bold mb-4 ${profile?.role === 'owner' ? 'text-blue-900' : profile?.role === 'tenant' ? 'text-emerald-900' : ''}`}>Contract Details</h1>
			{loading && <div>Loading...</div>}
			{msg && <div className="mb-4 p-3 rounded border border-gray-200 bg-gray-50 text-gray-700">{msg}</div>}
			{!contractId && <div className="text-gray-600">No contract selected. Append ?id=&lt;uuid&gt; to the URL.</div>}
      {contract && (
				<div className="space-y-4">
					<div>
						<div className="text-lg font-semibold">{contract.title}</div>
						<div className="text-sm text-gray-600">Status: {contract.status}</div>
					</div>
          <div className="border rounded p-3 bg-white">
            <div className="font-medium mb-2 ${profile?.role === 'owner' ? 'text-blue-900' : profile?.role === 'tenant' ? 'text-emerald-900' : ''}">Document</div>
						{('pdf_url' in contract) && contract.pdf_url ? (
							<a href={contract.pdf_url} target="_blank" rel="noreferrer" className="text-sa-blue-600 underline">Download PDF</a>
						) : (
							<div className="text-sm text-gray-500">PDF not finalized yet.</div>
						)}
						{('pdf_sha256' in contract) && contract.pdf_sha256 && (
							<div className="text-xs text-gray-500 break-all">SHA256: {contract.pdf_sha256}</div>
						)}
					</div>
          <Signatures contractId={contractId} isService={isService} />
				</div>
			)}
		</div>
	)
}

function Signatures({ contractId, isService }: { contractId: string; isService: boolean }) {
  const [sigs, setSigs] = useState<{ signer_role: string; signed_at: string }[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    const load = async () => {
      try {
        const table = isService ? 'service_contract_signatures' : 'tenancy_contract_signatures'
        const { data } = await supabase
          .from(table)
          .select('signer_role,signed_at')
          .eq('contract_id', contractId)
          .order('signed_at', { ascending: true })
        setSigs(data || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load signatures')
      }
    }
    load()
  }, [contractId, isService])
  if (error) return <div className="text-sm text-red-600">{error}</div>
  return (
    <div className="border rounded p-3">
      <div className="font-medium mb-2">Signatures</div>
      {sigs.length === 0 && <div className="text-sm text-gray-500">No signatures yet.</div>}
      <ul className="text-sm text-gray-700 space-y-1">
        {sigs.map((s, idx) => (
          <li key={idx}>{s.signer_role} • {new Date(s.signed_at).toLocaleString()}</li>
        ))}
      </ul>
    </div>
  )
}


