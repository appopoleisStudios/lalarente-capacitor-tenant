'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type PODetail = {
	id: string
	po_number: string | null
	status: string | null
	subtotal: number | null
	vat_amount: number | null
	platform_fee_amount: number | null
	total_amount: number | null
	created_at: string | null
	contract: {
		id: string
		title: string | null
		property: { id: string; title: string | null } | null
		vendor: { id: string; full_name: string | null } | null
		owner: { id: string; full_name: string | null } | null
	} | null
	lines: {
		id: string
		description: string | null
		qty: number | null
		unit_price: number | null
		unit: string | null
		tax_rate: number | null
	}[]
}

export default function OwnerPOViewPage() {
	const { id } = useParams<{ id: string }>()
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [po, setPO] = useState<PODetail | null>(null)

	useEffect(() => {
		const load = async () => {
			if (!id) return
			setLoading(true)
			setError(null)
			try {
				const { data, error } = await supabase
					.from('purchase_orders')
					.select(`
						id,
						po_number,
						status,
						subtotal,
						vat_amount,
						platform_fee_amount,
						total_amount,
						created_at,
						contract:service_contracts(
							id,
							title,
							property:properties(id, title),
							vendor:profiles!service_contracts_vendor_id_fkey(id, full_name),
							owner:profiles!service_contracts_owner_id_fkey(id, full_name)
						),
						lines:purchase_order_lines(
							id,
							description,
							qty,
							unit_price,
							unit,
							tax_rate
						)
					`)
					.eq('id', id)
					.single()

				if (error) throw error
				setPO(data as PODetail)
			} catch (e) {
				setError(e instanceof Error ? e.message : 'Failed to load purchase order')
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [id])

	const formatCurrency = (amount: number | null) => {
		return amount != null ? `R ${amount.toFixed(2)}` : '-'
	}

	const formatDate = (dateString: string | null) => {
		return dateString ? new Date(dateString).toLocaleDateString() : '-'
	}

	return (
		<ProtectedRoute allowedRoles={['owner']}>
			<div className="max-w-sm mx-auto p-4 space-y-4">
				<div className="flex items-center gap-3 mb-4">
					<Link href="/dashboard/owner/quotes" className="text-blue-600">
						← Back to Quotes
					</Link>
				</div>
				
				<div className="text-xl font-bold">Purchase Order</div>
				
				{loading && <div>Loading...</div>}
				{error && <div className="text-red-600 text-sm">{error}</div>}
				
				{!loading && !error && po && (
					<>
						{/* PO Header */}
						<div className="bg-white rounded-lg border p-4">
							<div className="flex justify-between items-start mb-3">
								<div>
									<div className="text-lg font-semibold">PO #{po.po_number || 'N/A'}</div>
									<div className="text-sm text-gray-600">Status: {po.status || '—'}</div>
								</div>
								<div className="text-right">
									<div className="text-sm text-gray-600">Created</div>
									<div className="text-sm">{formatDate(po.created_at)}</div>
								</div>
							</div>
							
							{po.contract && (
								<div className="space-y-2 text-sm">
									<div><span className="font-medium">Contract:</span> {po.contract.title || '—'}</div>
									<div><span className="font-medium">Property:</span> {po.contract.property?.title || '—'}</div>
									<div><span className="font-medium">Vendor:</span> {po.contract.vendor?.full_name || '—'}</div>
									<div><span className="font-medium">Owner:</span> {po.contract.owner?.full_name || '—'}</div>
								</div>
							)}
						</div>

						{/* Line Items */}
						{po.lines && po.lines.length > 0 && (
							<div className="bg-white rounded-lg border p-4">
								<div className="text-sm font-medium mb-3">Line Items</div>
								<div className="space-y-3">
									{po.lines.map(line => (
										<div key={line.id} className="flex justify-between items-start text-sm">
											<div className="flex-1">
												<div className="font-medium">{line.description || '—'}</div>
												<div className="text-gray-600">
													{line.qty || 1} × {formatCurrency(line.unit_price)}
													{line.unit && ` per ${line.unit}`}
												</div>
											</div>
											<div className="text-right">
												<div className="font-medium">
													{formatCurrency((line.qty || 1) * (line.unit_price || 0))}
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Totals */}
						<div className="bg-white rounded-lg border p-4">
							<div className="text-sm font-medium mb-3">Summary</div>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span>Subtotal</span>
									<span>{formatCurrency(po.subtotal)}</span>
								</div>
								{po.vat_amount && po.vat_amount > 0 && (
									<div className="flex justify-between">
										<span>VAT (15%)</span>
										<span>{formatCurrency(po.vat_amount)}</span>
									</div>
								)}
								{po.platform_fee_amount && po.platform_fee_amount > 0 && (
									<div className="flex justify-between">
										<span>Platform Fee</span>
										<span>{formatCurrency(po.platform_fee_amount)}</span>
									</div>
								)}
								<div className="flex justify-between font-semibold border-t pt-2">
									<span>Total</span>
									<span>{formatCurrency(po.total_amount)}</span>
								</div>
							</div>
						</div>

						{/* Actions */}
						<div className="flex gap-3">
							<button 
								className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
								onClick={() => {
									// TODO: Implement PDF download
									alert('PDF download coming soon')
								}}
							>
								Download PDF
							</button>
							<button 
								className="flex-1 px-4 py-2 bg-gray-100 border text-gray-700 rounded-lg hover:bg-gray-200"
								onClick={() => {
									// TODO: Implement email PO
									alert('Email PO coming soon')
								}}
							>
								Email PO
							</button>
						</div>
					</>
				)}
			</div>
		</ProtectedRoute>
	)
}

