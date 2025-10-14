'use client'

import { useEffect, useState, useCallback } from 'react'
import React, { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import VendorHeader from '@/components/Vendor/VendorHeader'
import BottomNavbar from '@/components/BottomNavbar'
import { 
	ArrowLeft, 
	CheckCircle, 
	AlertTriangle,
	Star
} from 'lucide-react'

interface Contract {
	id: string
	title: string
	status: string
	contract_type?: string
	contract_value: number | null
	start_date: string | null
	end_date: string | null
	actual_duration_hours: number | null
	estimated_duration_hours: number | null
	property: {
		title: string
		address: string
	} | null
	owner: {
		id?: string
		full_name: string
		email: string | null
	} | null
}

function VendorContractUpdateStatusPageInner() {
	const searchParams = useSearchParams()
	const id = searchParams.get('id')
	const router = useRouter()
	const { user } = useAuthStore()
	const [contract, setContract] = useState<Contract | null>(null)
	const [loading, setLoading] = useState(true)
	const [updating, setUpdating] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [newStatus, setNewStatus] = useState<'completed' | 'terminated'>('completed')
	const [completionNotes, setCompletionNotes] = useState('')
	const [actualHours, setActualHours] = useState('')
	const [rating, setRating] = useState(5)
	const [feedback, setFeedback] = useState('')

	const loadContract = useCallback(async () => {
		try {
			setLoading(true)
			const { data: contractData, error: contractError } = await supabase
				.from('service_contracts')
				.select(`
					*,
					property:properties(id, title, address),
					owner:profiles!service_contracts_owner_id_fkey(id, full_name, email)
				`)
				.eq('id', String(id))
				.eq('vendor_id', user?.id as string)
				.single()

			if (contractError) throw contractError

			if ((contractData as any).status !== 'active') {
				setError('This contract is not active and cannot be updated')
				return
			}

			setContract({
				id: (contractData as any).id,
				title: (contractData as any).title,
				status: (contractData as any).status,
				contract_type: (contractData as any).contract_type,
				contract_value: (contractData as any).contract_value ?? null,
				start_date: (contractData as any).start_date || null,
				end_date: (contractData as any).end_date || null,
				actual_duration_hours: (contractData as any).actual_duration_hours ?? null,
				estimated_duration_hours: (contractData as any).estimated_duration_hours ?? null,
				property: (contractData as any).property || null,
				owner: (contractData as any).owner || null,
			})
			if ((contractData as any).actual_duration_hours) {
				setActualHours(String((contractData as any).actual_duration_hours))
			}
		} catch (error) {
			console.error('Error loading contract:', error)
			setError('Failed to load contract')
		} finally {
			setLoading(false)
		}
	}, [id, user?.id])

	useEffect(() => {
		if (!user || !id) return
		loadContract()
	}, [loadContract])

	const updateContractStatus = async () => {
		if (!contract) return
		try {
			setUpdating(true)
			setError(null)
			const updateData: any = {
				status: newStatus,
				completion_date: new Date().toISOString()
			}
			if (newStatus === 'completed') {
				if (actualHours) updateData.actual_duration_hours = parseFloat(actualHours)
				if (completionNotes) updateData.vendor_notes = completionNotes
			}
			const { error: updateError } = await supabase
				.from('service_contracts')
				.update(updateData)
				.eq('id', contract.id)
			if (updateError) throw updateError
			await (supabase as any).rpc('log_contract_event', {
				p_contract_id: contract.id,
				p_event: newStatus === 'completed' ? 'contract_completed' : 'contract_terminated',
				p_new_values: { 
					status: newStatus,
					actual_duration_hours: actualHours ? parseFloat(actualHours) : null,
					completion_notes: completionNotes
				}
			})
			await (supabase as any).rpc('create_contract_notification', {
				p_contract_id: contract.id,
				p_recipient_id: contract.owner?.id || null,
				p_notification_type: 'status_change',
				p_title: `Contract ${newStatus === 'completed' ? 'Completed' : 'Terminated'}`,
				p_message: `Contract "${contract.title}" has been marked as ${newStatus} by the vendor.`
			})
			if (newStatus === 'completed') {
				await (supabase as any)
					.from('service_contracts')
					.update({ vendor_rating: rating as any, vendor_feedback: feedback || null })
					.eq('id', contract.id)
				await (supabase as any).rpc('log_contract_event', {
					p_contract_id: contract.id,
					p_event: 'vendor_rating_submitted',
					p_new_values: { rating, feedback }
				})
			}
			router.push(`/dashboard/vendor/contracts/view?id=${contract.id}`)
		} catch (error) {
			console.error('Error updating contract status:', error)
			setError('Failed to update contract status. Please try again.')
		} finally {
			setUpdating(false)
		}
	}

	const formatCurrency = (amount: number | null) => {
		if (!amount) return 'Not specified'
		return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
	}

	const formatDate = (dateString: string | null) => {
		if (!dateString) return 'Not set'
		return new Date(dateString).toLocaleDateString('en-ZA')
	}

	if (loading) {
		return (
			<ProtectedRoute allowedRoles={['vendor']}>
				<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden">
					<VendorHeader />
					<div className="flex items-center justify-center py-8">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
					</div>
				</div>
			</ProtectedRoute>
		)
	}

	if (error && !contract) {
		return (
			<ProtectedRoute allowedRoles={['vendor']}>
				<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden">
					<VendorHeader />
					<div className="text-center py-8">
						<AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
						<h3 className="mt-2 text-lg font-medium text-gray-900">Error</h3>
						<p className="mt-1 text-gray-500">{error}</p>
						<button onClick={() => router.back()} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
							Go Back
						</button>
					</div>
				</div>
			</ProtectedRoute>
		)
	}

	return (
		<ProtectedRoute allowedRoles={['vendor']}>
			<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden">
				<VendorHeader />
				<main className="px-4 py-4 space-y-4">
					<div className="flex items-center gap-3 mb-4">
						<button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
							<ArrowLeft className="h-5 w-5 text-gray-700" />
						</button>
						<div className="flex-1">
							<h1 className="text-xl font-bold text-gray-900">Update Contract Status</h1>
							<p className="text-sm text-gray-600">{contract?.title}</p>
						</div>
					</div>

					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<h3 className="font-semibold text-gray-900 mb-3">Contract Details</h3>
						<div className="space-y-2 text-sm">
							<div><span className="text-gray-700">Property:</span> <span className="ml-2 font-medium text-gray-900">{contract?.property?.title}</span></div>
							<div><span className="text-gray-700">Address:</span> <span className="ml-2 text-gray-900">{contract?.property?.address}</span></div>
							<div><span className="text-gray-700">Value:</span> <span className="ml-2 font-medium text-gray-900">{formatCurrency(contract?.contract_value ?? null)}</span></div>
							<div><span className="text-gray-700">Start Date:</span> <span className="ml-2 text-gray-900">{formatDate(contract?.start_date ?? null)}</span></div>
							<div><span className="text-gray-700">End Date:</span> <span className="ml-2 text-gray-900">{formatDate(contract?.end_date ?? null)}</span></div>
						</div>
					</div>

					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<h3 className="font-semibold text-gray-900 mb-3">Select New Status</h3>
						<div className="space-y-3">
							<label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
								<input type="radio" name="status" value="completed" checked={newStatus === 'completed'} onChange={(e) => setNewStatus(e.target.value as 'completed' | 'terminated')} className="text-blue-600" />
								<CheckCircle className="h-5 w-5 text-green-600" />
								<div>
									<div className="font-medium text-gray-900">Mark as Completed</div>
									<div className="text-sm text-gray-600">Work has been finished successfully</div>
								</div>
							</label>
							<label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
								<input type="radio" name="status" value="terminated" checked={newStatus === 'terminated'} onChange={(e) => setNewStatus(e.target.value as 'completed' | 'terminated')} className="text-blue-600" />
								<AlertTriangle className="h-5 w-5 text-red-600" />
								<div>
									<div className="font-medium text-gray-900">Terminate Contract</div>
									<div className="text-sm text-gray-600">Contract needs to be ended early</div>
								</div>
							</label>
						</div>
					</div>

					{newStatus === 'completed' && (
						<>
							<div className="bg-white border border-gray-200 rounded-lg p-4">
								<h3 className="font-semibold text-gray-900 mb-3">Completion Details</h3>
								<div className="space-y-3">
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">Actual Hours Worked</label>
										<input type="number" step="0.5" min="0" value={actualHours} onChange={(e) => setActualHours(e.target.value)} placeholder="Enter hours worked" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">Completion Notes</label>
										<textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} placeholder="Describe the work completed, any issues encountered, or additional notes..." rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
									</div>
								</div>
							</div>
							<div className="bg-white border border-gray-200 rounded-lg p-4">
								<h3 className="font-semibold text-gray-900 mb-3">Rate Your Experience</h3>
								<div className="space-y-3">
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-2">How would you rate this contract?</label>
										<div className="flex gap-2">
											{[1,2,3,4,5].map(star => (
												<button key={star} onClick={() => setRating(star)} className={`p-1 rounded ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}>
													<Star className="h-6 w-6 fill-current" />
												</button>
											))}
										</div>
										<p className="text-xs text-gray-500 mt-1">
											{rating === 1 && 'Poor'}
											{rating === 2 && 'Fair'}
											{rating === 3 && 'Good'}
											{rating === 4 && 'Very Good'}
											{rating === 5 && 'Excellent'}
										</p>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">Feedback (Optional)</label>
										<textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Share your experience working on this contract..." rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
									</div>
								</div>
							</div>
						</>
					)}

					{error && (<div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-sm text-red-600">{error}</p></div>)}

					<div className="space-y-3">
						<button onClick={updateContractStatus} disabled={updating} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2">
							{updating ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>Updating...</>) : (<><CheckCircle className="h-4 w-4" />Update Status</>)}
						</button>
						<button onClick={() => router.back()} className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300">Cancel</button>
					</div>
				</main>
				<BottomNavbar userRole="vendor" />
			</div>
		</ProtectedRoute>
	)
}

export default function VendorContractUpdateStatusPage() {
  return (
    <Suspense fallback={<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden"><div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div></div>}>
      <VendorContractUpdateStatusPageInner />
    </Suspense>
  )
}


