'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase } from '@/lib/supabase'

type RequestDetail = {
	id: string
	title: string
	description: string
	priority: string | null
	created_at: string
	property: { id: string; title: string | null; address: string | null } | null
	owner_id: string | null
	selected_quote_id: string | null
	po_id: string | null
}

type QuoteSummary = {
	id: string
	status: string | null
	subtotal: number | null
	total_amount: number | null
	vendor: { id: string; full_name: string | null } | null
	contract_id: string | null
}

export default function OwnerRequestDetailPage() {
	const { id } = useParams<{ id: string }>()
	const router = useRouter()
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [request, setRequest] = useState<RequestDetail | null>(null)
	const [quotes, setQuotes] = useState<QuoteSummary[]>([])
	const [approving, setApproving] = useState(false)
const [inviting] = useState(false)

	useEffect(() => {
		const load = async () => {
			if (!id) return
			setLoading(true)
			setError(null)
			try {
				const { data: req, error: reqErr } = await supabase
					.from('maintenance_requests')
					.select(`
						id, title, description, priority, created_at, owner_id, selected_quote_id, po_id,
						property:properties(id, title, address)
					`)
					.eq('id', id)
					.single()
				if (reqErr) throw reqErr
				setRequest(req as unknown as RequestDetail)


				// Primary: quotes linked directly to this maintenance request
				const { data: qs, error: qErr } = await supabase
					.from('quotes')
					.select(`
						id, status, subtotal, total_amount, contract_id,
						vendor:profiles!quotes_vendor_id_fkey(id, full_name)
					`)
					.eq('request_id', id)
					.order('created_at', { ascending: false })
				if (qErr) throw qErr

				// Fallback: quotes linked via contract to this maintenance request
				const { data: scList, error: scErr } = await supabase
					.from('service_contracts')
					.select('id')
					.eq('maintenance_request_id', id)
				if (scErr) throw scErr
				let viaContracts: QuoteSummary[] = []
				if (scList && scList.length > 0) {
					const contractIds = scList.map(s => s.id)
					const { data: qs2, error: q2Err } = await supabase
						.from('quotes')
						.select(`
							id, status, subtotal, total_amount, contract_id,
							vendor:profiles!quotes_vendor_id_fkey(id, full_name)
						`)
						.in('contract_id', contractIds)
						.order('created_at', { ascending: false })
					if (q2Err) throw q2Err
					viaContracts = (qs2 as unknown as QuoteSummary[]) || []
				}

				// Merge and dedupe by id
				const allQuotesMap = new Map<string, QuoteSummary>()
				for (const q of (qs as unknown as QuoteSummary[]) || []) allQuotesMap.set(q.id, q)
				for (const q of viaContracts) allQuotesMap.set(q.id, q)
				setQuotes(Array.from(allQuotesMap.values()))
			} catch (e) {
				setError(e instanceof Error ? e.message : 'Failed to load request details')
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [id])

	const selectedQuote = useMemo(() => {
		if (!request?.selected_quote_id) return null
		return quotes.find(q => q.id === request.selected_quote_id) || null
	}, [request, quotes])

	const [signaturesOk, setSignaturesOk] = useState(false)
	useEffect(() => {
		const checkSigs = async () => {
			if (!selectedQuote?.contract_id) {
				setSignaturesOk(false)
				return
			}
			const { data, error } = await supabase
				.from('service_contract_signatures')
				.select('signer_role')
				.eq('contract_id', selectedQuote.contract_id)
			if (error) {
				setSignaturesOk(false)
				return
			}
			const roles = (data || []).map(r => (r.signer_role || '').toLowerCase())
			setSignaturesOk(roles.includes('owner') && roles.includes('vendor'))
		}
		checkSigs()
	}, [selectedQuote?.contract_id])

	const approveAndIssuePO = async () => {
		if (!selectedQuote?.id) return
		if (!signaturesOk) {
			alert('Both signatures are required before issuing a PO.')
			return
		}
		setApproving(true)
		try {
			const { error } = await supabase.rpc('approve_quote_and_generate_po', { quote_id: selectedQuote.id })
			if (error) throw error
			// Reload page to reflect PO
			window.location.reload()
		} catch (e) {
			console.error('approve_quote_and_generate_po RPC error', e)
			alert(`Failed to issue PO: ${e instanceof Error ? e.message : 'Unknown error'}`)
		} finally {
			setApproving(false)
		}
	}

    const inviteVendors = async () => {
        if (!request?.id) return
        // Route to edit screen for this maintenance to choose Open Market or Closed Vendors
        router.push(`/dashboard/owner/maintenance/${request.id}/edit`)
    }

	return (
		<ProtectedRoute allowedRoles={['owner']}>
			<div className="max-w-sm mx-auto p-4 space-y-4">
				<div className="flex items-center justify-between">
					<Link href="/dashboard/owner/maintenance" className="text-blue-600 text-sm">Back</Link>
					<div className="text-lg font-bold">Request Details</div>
				</div>

				{loading && <div>Loading...</div>}
				{error && <div className="text-red-600 text-sm">{error}</div>}

				{!loading && !error && request && (
					<>
						<div className="bg-white rounded-lg border p-4 space-y-2">
							<div className="text-base font-semibold">{request.title}</div>
							<div className="text-sm text-gray-600">{request.description}</div>
							<div className="text-xs text-gray-500">Priority: {request.priority || '—'}</div>
							<div className="text-xs text-gray-500">Property: {request.property?.title} • {request.property?.address}</div>
						</div>

						<div className="bg-white rounded-lg border p-4 space-y-3">
							<div className="text-sm font-medium">Quotes</div>
							<div className="space-y-2">
							{quotes.length === 0 && (
								<div className="flex items-center justify-between">
									<div className="text-xs text-gray-500">No quotes yet.</div>
									<button
										onClick={inviteVendors}
										disabled={inviting}
										className="px-3 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-50"
									>
										Invite Vendors
									</button>
								</div>
							)}
								{quotes.map(q => (
									<div key={q.id} className="border rounded-lg p-3 flex items-center justify-between">
										<div>
											<div className="text-sm font-semibold">{q.vendor?.full_name || 'Vendor'}</div>
											<div className="text-xs text-gray-600">Status: {q.status}</div>
											<div className="text-xs text-gray-600">Total: {q.total_amount ?? q.subtotal ?? 0}</div>
										</div>
										<div className="flex items-center gap-2">
											<Link href={`/dashboard/owner/quotes/${q.id}/review`} className="px-3 py-1 text-xs rounded bg-gray-100">Review Quote</Link>
											{q.contract_id && (
												<Link href={`/contracts?id=${q.contract_id}#contract-messages`} className="px-3 py-1 text-xs rounded bg-gray-100">Sign Contract</Link>
											)}
											{q.id === request.selected_quote_id && (
												<button
													onClick={approveAndIssuePO}
													disabled={!signaturesOk || approving}
													className="px-3 py-1 text-xs rounded bg-indigo-600 text-white disabled:opacity-50"
												>
													Approve → Issue PO
												</button>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					</>
				)}
			</div>
		</ProtectedRoute>
	)
}


