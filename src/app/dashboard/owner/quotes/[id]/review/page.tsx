'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'

type QuoteDetail = {
	id: string
	status: string | null
	subtotal: number | null
	vat_amount: number | null
	discount_amount: number | null
	total_amount: number | null
	created_at: string | null
	contract_id?: string | null
	request_id?: string | null
	property: { id: string; title: string | null } | null
	vendor: { id: string; full_name: string | null } | null
	lines: { id: string; description: string | null; qty: number | null; unit_price: number | null; unit: string | null }[]
}

export default function OwnerQuoteReviewPage() {
	const { id } = useParams<{ id: string }>()
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [quote, setQuote] = useState<QuoteDetail | null>(null)
	const [approving, setApproving] = useState(false)

	useEffect(() => {
		const load = async () => {
			if (!id) return
			setLoading(true)
			setError(null)
			try {
				const { data, error } = await (supabase as any)
					.from('quotes')
					.select(`id,status,subtotal,vat_amount,discount_amount,total_amount,created_at,contract_id,request_id,property:properties(id,title),vendor:profiles!quotes_vendor_id_fkey(id,full_name),lines:quote_lines(id,description,qty,unit_price,unit)`) // any for simplicity
					.eq('id', id)
					.single()
				if (error) throw error
				setQuote(data as QuoteDetail)
			} catch (e) {
				setError(e instanceof Error ? e.message : 'Failed to load quote')
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [id])

	const handleApproveQuote = async () => {
		if (!id) return
		
		setApproving(true)
		setError(null)
		
		try {
			// Call the RPC function to approve quote and generate PO
			// Prefer approving quotes that are tied to a maintenance request to satisfy RPC requirements
			const quoteId = id
			const { data, error } = await supabase.rpc('approve_quote_and_generate_po', { quote_id: quoteId })
			if (error) {
				// Surface full error for debugging in Network/Console
				// eslint-disable-next-line no-console
				console.error('approve_quote_and_generate_po RPC error:', JSON.stringify(error, null, 2))
				throw error
			}
			
			// Show success message and redirect to the contract that now has the PO
			alert(`Quote approved! Purchase Order ${data} has been generated.`)
			try {
				let destContractId = quote?.contract_id || null
				if (!destContractId && quote?.request_id) {
					const { data: sc } = await (supabase as any)
						.from('service_contracts')
						.select('id')
						.eq('maintenance_request_id', quote.request_id)
						.order('created_at', { ascending: false })
						.limit(1)
						.maybeSingle()
					destContractId = sc?.id || null
				}
				if (destContractId) {
					window.location.href = `/contracts?id=${destContractId}`
				} else {
					window.location.href = '/dashboard/owner/quotes'
				}
			} catch {
				window.location.href = '/dashboard/owner/quotes'
			}
			
		} catch (e) {
			// eslint-disable-next-line no-console
			console.error('Failed to approve quote RPC call:', e)
			setError(e instanceof Error ? e.message : 'Failed to approve quote')
		} finally {
			setApproving(false)
		}
	}

	return (
		<ProtectedRoute allowedRoles={['owner']}>
			<div className="max-w-sm mx-auto p-4 space-y-4">
				<div className="text-xl font-bold">Review Quote</div>
				{loading && <div>Loading...</div>}
				{error && <div className="text-red-600 text-sm">{error}</div>}
				{!loading && !error && quote && (
					<>
						<div className="bg-white rounded-lg border p-3">
							<div className="flex justify-between text-sm">
								<div className="font-medium">{quote.property?.title || 'Property'}</div>
								<div className="text-gray-600">{quote.status || '—'}</div>
							</div>
							<div className="text-xs text-gray-600 mt-1">Vendor: {quote.vendor?.full_name || '—'}</div>
							<div className="mt-2 text-sm">
								<div className="flex justify-between"><span>Subtotal</span><span>{quote.subtotal != null ? `R ${quote.subtotal}` : '-'}</span></div>
								<div className="flex justify-between"><span>VAT</span><span>{quote.vat_amount != null ? `R ${quote.vat_amount}` : '-'}</span></div>
								<div className="flex justify-between"><span>Discount</span><span>{quote.discount_amount != null ? `R ${quote.discount_amount}` : '-'}</span></div>
								<div className="flex justify-between font-medium"><span>Total</span><span>{quote.total_amount != null ? `R ${quote.total_amount}` : '-'}</span></div>
							</div>
						</div>
						<div className="bg-white rounded-lg border p-3">
							<div className="text-sm font-medium mb-2">Line Items</div>
							<div className="space-y-2">
								{(quote.lines || []).map(l => (
									<div key={l.id} className="flex justify-between text-sm">
										<div>{l.description || '-'}</div>
										<div className="text-gray-600">{l.qty || 1} × {l.unit_price != null ? `R ${l.unit_price}` : '-'}</div>
									</div>
								))}
							</div>
						</div>
						<div className="flex gap-3">
							<button 
								className="px-3 py-2 rounded-lg bg-gray-100 border text-gray-700"
								disabled={approving}
							>
								Decline
							</button>
							<button 
								className="px-3 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
								onClick={handleApproveQuote}
								disabled={approving}
							>
								{approving ? 'Approving...' : 'Approve → Issue PO'}
							</button>
						</div>
					</>
				)}
			</div>
		</ProtectedRoute>
	)
}


