'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react'

type ClosureData = {
	id: string
	contract_id: string
	vendor_notes: string | null
	owner_accept_at: string | null
	tenant_ack_at: string | null
	closed_at: string | null
	contract: {
		id: string
		title: string | null
		property: { id: string; title: string | null; address: string | null } | null
		vendor: { id: string; full_name: string | null } | null
	} | null
}

export default function OwnerClosurePage() {
	const { contractId } = useParams<{ contractId: string }>()
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [closure, setClosure] = useState<ClosureData | null>(null)
	const [processing, setProcessing] = useState(false)

	useEffect(() => {
		const load = async () => {
			if (!contractId) return
			setLoading(true)
			setError(null)
			try {
				const { data, error } = await supabase
					.from('closure_reports')
					.select(`
						id,
						contract_id,
						vendor_notes,
						owner_accept_at,
						tenant_ack_at,
						closed_at,
						contract:service_contracts(
							id,
							title,
							property:properties(id, title, address),
							vendor:profiles!service_contracts_vendor_id_fkey(id, full_name)
						)
					`)
					.eq('contract_id', contractId)
					.single()

				if (error) throw error
				setClosure(data as ClosureData)
			} catch (e) {
				setError(e instanceof Error ? e.message : 'Failed to load closure data')
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [contractId])

	const handleAcceptClosure = async () => {
		if (!closure?.id) return

		setProcessing(true)
		try {
			const { error } = await supabase
				.from('closure_reports')
				.update({
					owner_accept_at: new Date().toISOString()
				})
				.eq('id', closure.id)

			if (error) throw error

			// Reload closure data
			const { data, error: reloadError } = await supabase
				.from('closure_reports')
				.select(`
					id,
					contract_id,
					vendor_notes,
					owner_accept_at,
					tenant_ack_at,
					closed_at,
					contract:service_contracts(
						id,
						title,
						property:properties(id, title, address),
						vendor:profiles!service_contracts_vendor_id_fkey(id, full_name)
					)
				`)
				.eq('contract_id', contractId)
				.single()

			if (reloadError) throw reloadError
			setClosure(data as ClosureData)

			alert('Closure report accepted successfully!')
		} catch (e) {
			alert(`Failed to accept closure: ${e instanceof Error ? e.message : 'Unknown error'}`)
		} finally {
			setProcessing(false)
		}
	}

	const handleRejectClosure = async () => {
		if (!closure?.id) return

		const reason = prompt('Please provide a reason for rejecting the closure:')
		if (!reason) return

		setProcessing(true)
		try {
			// For now, we'll just update the notes with rejection reason
			// In a full implementation, you might want a separate rejection table
			const { error } = await supabase
				.from('closure_reports')
				.update({
					vendor_notes: `${closure.vendor_notes}\n\n--- REJECTION ---\nReason: ${reason}\nRejected at: ${new Date().toLocaleString()}`
				})
				.eq('id', closure.id)

			if (error) throw error

			alert('Closure report rejected. The vendor will be notified.')
			window.location.href = '/dashboard/owner/contracts'
		} catch (e) {
			alert(`Failed to reject closure: ${e instanceof Error ? e.message : 'Unknown error'}`)
		} finally {
			setProcessing(false)
		}
	}

	const formatDate = (dateString: string | null) => {
		return dateString ? new Date(dateString).toLocaleString() : '-'
	}

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'pending': return 'bg-yellow-100 text-yellow-700'
			case 'accepted': return 'bg-green-100 text-green-700'
			case 'rejected': return 'bg-red-100 text-red-700'
			default: return 'bg-gray-100 text-gray-700'
		}
	}

	const getStatusText = () => {
		if (!closure) return 'Not Submitted'
		if (closure.owner_accept_at) return 'Accepted'
		if (closure.closed_at && !closure.owner_accept_at) return 'Pending Approval'
		return 'Not Submitted'
	}

	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'pending': return <Clock className="w-4 h-4" />
			case 'accepted': return <CheckCircle className="w-4 h-4" />
			case 'rejected': return <XCircle className="w-4 h-4" />
			default: return null
		}
	}

	return (
		<ProtectedRoute allowedRoles={['owner']}>
			<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-gray-50 min-h-screen pb-20 overflow-x-hidden">
				{/* Dark Header */}
				<div className="px-4 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500">
					<div className="max-w-sm mx-auto text-white">
						<div className="flex items-center gap-3">
							<Link href="/dashboard/owner/contracts" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
								<ArrowLeft className="w-5 h-5 text-white" />
							</Link>
							<div className="text-xl font-bold">Job Closure Review</div>
						</div>
					</div>
				</div>

				{/* Body */}
				<div className="max-w-sm mx-auto p-4 space-y-4">
				
				{loading && <div>Loading...</div>}
				{error && <div className="text-red-600 text-sm">{error}</div>}
				
				{!loading && !error && closure && (
					<>
						{/* Job Info */}
						<div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
							<div className="flex items-center justify-between mb-3">
								<div>
									<div className="text-lg font-semibold text-gray-900">{closure.contract?.title || 'Job'}</div>
									<div className="text-sm text-gray-700">{closure.contract?.property?.title || 'Property'}</div>
								</div>
								<div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${getStatusColor(getStatusText())}`}>
									{getStatusIcon(getStatusText())}
									{getStatusText()}
								</div>
							</div>
							
							<div className="space-y-2 text-sm text-gray-800">
								<div><span className="font-medium">Property:</span> {closure.contract?.property?.address || '—'}</div>
								<div><span className="font-medium">Vendor:</span> {closure.contract?.vendor?.full_name || '—'}</div>
								{closure.closed_at && (
									<div><span className="font-medium">Submitted:</span> {formatDate(closure.closed_at)}</div>
								)}
								{closure.owner_accept_at && (
									<div><span className="font-medium">Accepted:</span> {formatDate(closure.owner_accept_at)}</div>
								)}
							</div>
						</div>

						{/* Closure Report */}
						<div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
							<div className="text-base font-semibold text-gray-900 mb-3">Vendor Closure Report</div>
							{closure.vendor_notes ? (
								<div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-800 whitespace-pre-wrap">
									{closure.vendor_notes}
								</div>
							) : (
								<div className="text-gray-500 text-sm italic">No closure notes provided.</div>
							)}
						</div>

						{/* Work Verification Checklist */}
						<div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
							<div className="text-base font-semibold text-gray-900 mb-3">Work Verification</div>
							<div className="space-y-3">
								<div className="flex items-start gap-3">
									<input type="checkbox" id="work-complete" className="mt-1" />
									<label htmlFor="work-complete" className="text-sm text-gray-800">
										All contracted work has been completed satisfactorily
									</label>
								</div>
								<div className="flex items-start gap-3">
									<input type="checkbox" id="area-clean" className="mt-1" />
									<label htmlFor="area-clean" className="text-sm text-gray-800">
										Work area has been cleaned and restored to original condition
									</label>
								</div>
								<div className="flex items-start gap-3">
									<input type="checkbox" id="materials-removed" className="mt-1" />
									<label htmlFor="materials-removed" className="text-sm text-gray-800">
										All materials, tools, and debris have been removed
									</label>
								</div>
								<div className="flex items-start gap-3">
									<input type="checkbox" id="photos-reviewed" className="mt-1" />
									<label htmlFor="photos-reviewed" className="text-sm text-gray-800">
										Before/after photos have been reviewed and are satisfactory
									</label>
								</div>
								<div className="flex items-start gap-3">
									<input type="checkbox" id="quality-check" className="mt-1" />
									<label htmlFor="quality-check" className="text-sm text-gray-800">
										Work quality meets expected standards
									</label>
								</div>
							</div>
						</div>

						{/* Action Buttons */}
						{closure.closed_at && !closure.owner_accept_at && (
							<div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
								<div className="text-base font-semibold text-gray-900 mb-3">Review Actions</div>
								<div className="grid grid-cols-2 gap-3">
									<button
										onClick={handleRejectClosure}
										disabled={processing}
										className="h-12 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
									>
										<XCircle className="w-4 h-4" />
										Reject
									</button>
									<button
										onClick={handleAcceptClosure}
										disabled={processing}
										className="h-12 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
									>
										<CheckCircle className="w-4 h-4" />
										Accept
									</button>
								</div>
								<div className="text-xs text-gray-500 mt-2 text-center">
									Review the work and vendor report before making a decision.
								</div>
							</div>
						)}

						{/* Status Messages */}
						{closure.closed_at && !closure.owner_accept_at && (
							<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
								<div className="text-sm text-yellow-800">
									<strong>Pending Your Review</strong><br />
									The vendor has submitted a closure report. Please review the work and vendor notes before accepting or rejecting.
								</div>
							</div>
						)}

						{closure.closed_at && closure.owner_accept_at && (
							<div className="bg-green-50 border border-green-200 rounded-lg p-4">
								<div className="text-sm text-green-800">
									<strong>Closure Accepted</strong><br />
									You have accepted the vendor's closure report. This job is now complete and ready for final payment processing.
								</div>
							</div>
						)}

						{!closure.closed_at && (
							<div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
								<div className="text-sm text-gray-800">
									<strong>No Closure Report</strong><br />
									The vendor has not yet submitted a closure report for this job.
								</div>
							</div>
						)}
					</>
				)}
				</div>
			</div>
		</ProtectedRoute>
	)
}


