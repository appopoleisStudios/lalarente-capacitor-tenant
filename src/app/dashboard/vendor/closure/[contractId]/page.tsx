'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, FileText } from 'lucide-react'

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
		owner: { id: string; full_name: string | null } | null
	} | null
}

export default function VendorClosurePage() {
	const { contractId } = useParams<{ contractId: string }>()
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [closure, setClosure] = useState<ClosureData | null>(null)
	const [submitting, setSubmitting] = useState(false)
	const [vendorNotes, setVendorNotes] = useState('')
// Note: uploading left out for now as storage is deferred

	useEffect(() => {
		const load = async () => {
			if (!contractId) return
			setLoading(true)
			setError(null)
			try {
				// Check if closure report already exists
				const { data: existingClosure, error: closureError } = await supabase
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
							owner:profiles!service_contracts_owner_id_fkey(id, full_name)
						)
					`)
					.eq('contract_id', contractId)
					.single()

				if (closureError && closureError.code !== 'PGRST116') {
					throw closureError
				}

				if (existingClosure) {
					setClosure(existingClosure as ClosureData)
					setVendorNotes(existingClosure.vendor_notes || '')
				} else {
					// Load contract data for new closure
					const { data: contractData, error: contractError } = await supabase
						.from('service_contracts')
						.select(`
							id,
							title,
							property:properties(id, title, address),
							owner:profiles!service_contracts_owner_id_fkey(id, full_name)
						`)
						.eq('id', contractId)
						.single()

					if (contractError) throw contractError

					setClosure({
						id: '',
						contract_id: contractId,
						vendor_notes: null,
						owner_accept_at: null,
						tenant_ack_at: null,
						closed_at: null,
						contract: contractData
					})
				}
			} catch (e) {
				setError(e instanceof Error ? e.message : 'Failed to load closure data')
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [contractId])

	const handleSubmitClosure = async () => {
		if (!contractId || !vendorNotes.trim()) {
			alert('Please provide closure notes before submitting.')
			return
		}

		setSubmitting(true)
		try {
			if (closure?.id) {
				// Update existing closure
				const { error } = await supabase
					.from('closure_reports')
					.update({
						vendor_notes: vendorNotes.trim(),
						closed_at: new Date().toISOString()
					})
					.eq('id', closure.id)

				if (error) throw error
			} else {
				// Create new closure
				const { error } = await supabase
					.from('closure_reports')
					.insert({
						contract_id: contractId,
						vendor_notes: vendorNotes.trim(),
						closed_at: new Date().toISOString()
					})

				if (error) throw error
			}

			alert('Closure report submitted successfully! The owner will be notified for approval.')
			window.location.href = '/dashboard/vendor/jobs'
		} catch (e) {
			alert(`Failed to submit closure: ${e instanceof Error ? e.message : 'Unknown error'}`)
		} finally {
			setSubmitting(false)
		}
	}

	const formatDate = (dateString: string | null) => {
		return dateString ? new Date(dateString).toLocaleString() : '-'
	}

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'submitted': return 'bg-blue-100 text-blue-700'
			case 'accepted': return 'bg-green-100 text-green-700'
			case 'rejected': return 'bg-red-100 text-red-700'
			default: return 'bg-gray-100 text-gray-700'
		}
	}

	const getStatusText = () => {
		if (!closure) return 'Draft'
		if (closure.closed_at && closure.owner_accept_at) return 'Accepted'
		if (closure.closed_at && !closure.owner_accept_at) return 'Pending Owner Approval'
		return 'Draft'
	}

	return (
		<ProtectedRoute allowedRoles={['vendor']}>
			<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-gray-50 min-h-screen pb-20 overflow-x-hidden">
				{/* Dark Header */}
                <div className="px-4 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500">
					<div className="max-w-sm mx-auto text-white">
						<div className="flex items-center gap-3">
							<Link href="/dashboard/vendor/jobs" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
								<ArrowLeft className="w-5 h-5 text-white" />
							</Link>
							<div className="text-xl font-bold">Job Closure</div>
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
                                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(getStatusText())}`}>
                                        {getStatusText()}
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm text-gray-800">
                                    <div><span className="font-medium">Property:</span> {closure.contract?.property?.address || '—'}</div>
                                    <div><span className="font-medium">Owner:</span> {closure.contract?.owner?.full_name || '—'}</div>
                                    {closure.closed_at && (
                                        <div><span className="font-medium">Submitted:</span> {formatDate(closure.closed_at)}</div>
                                    )}
                                    {closure.owner_accept_at && (
                                        <div><span className="font-medium">Owner Accepted:</span> {formatDate(closure.owner_accept_at)}</div>
                                    )}
                                </div>
                            </div>

                            {/* Closure Notes */}
                            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
                                <div className="text-base font-semibold text-gray-900 mb-3">Closure Report</div>
                                <textarea
                                    value={vendorNotes}
                                    onChange={(e) => setVendorNotes(e.target.value)}
                                    placeholder="Describe the work completed, any issues encountered, and final status..."
                                    className="w-full p-3 border border-gray-300 rounded-lg resize-none text-gray-900 placeholder-gray-500"
                                    rows={6}
                                disabled={Boolean(closure.closed_at && closure.owner_accept_at)}
                                />
                                <div className="text-xs text-gray-500 mt-2">
                                    Include details about work completed, materials used, any issues, and final status.
                                </div>
                            </div>

                            {/* Work Summary Checklist */}
                            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
                                <div className="text-base font-semibold text-gray-900 mb-3">Work Summary</div>
                                <div className="space-y-2 text-sm text-gray-800">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                        <span>All work completed as per contract</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                        <span>Work area cleaned and restored</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                        <span>All materials and tools removed</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                        <span>Before/after photos uploaded</span>
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            {!(closure.closed_at && closure.owner_accept_at) && (
                                <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
                                    <button
                                        onClick={handleSubmitClosure}
                                        disabled={submitting || !vendorNotes.trim()}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <FileText className="w-5 h-5" />
                                        {submitting ? 'Submitting...' : closure.closed_at ? 'Update Closure' : 'Submit Closure Report'}
                                    </button>
                                    <div className="text-xs text-gray-500 mt-2 text-center">
                                        Once submitted, the owner will be notified for approval.
                                    </div>
                                </div>
                            )}

                            {/* Status Messages */}
                            {closure.closed_at && !closure.owner_accept_at && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="text-sm text-blue-800">
                                        <strong>Closure Submitted</strong><br />
                                        Your closure report has been submitted and is pending owner approval.
                                        You will be notified once the owner reviews and accepts the closure.
                                    </div>
                                </div>
                            )}

                            {closure.closed_at && closure.owner_accept_at && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <div className="text-sm text-green-800">
                                        <strong>Closure Accepted</strong><br />
                                        The owner has accepted your closure report. This job is now complete.
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


