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
	AlertTriangle,
	MessageSquare
} from 'lucide-react'

interface Contract {
	id: string
	title: string
	status: string
	contract_type?: string
	contract_value: number | null
	start_date: string | null
	end_date: string | null
	property: {
		title: string
		address: string
	} | null
	owner: {
		id?: string
		full_name: string
		email: string | null
	} | null
	terms: any
}

function VendorContractRequestChangesPageInner() {
	const searchParams = useSearchParams()
	const id = searchParams.get('id')
	const router = useRouter()
	const { user } = useAuthStore()
	const [contract, setContract] = useState<Contract | null>(null)
	const [loading, setLoading] = useState(true)
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [changeRequest, setChangeRequest] = useState('')
	const [changeType, setChangeType] = useState<'terms' | 'schedule' | 'scope' | 'pricing' | 'other'>('terms')
	const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')

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
			if (contractData.status === 'completed' || contractData.status === 'terminated') {
				setError('This contract cannot be modified as it has already been completed or terminated')
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
				property: (contractData as any).property || null,
				owner: (contractData as any).owner || null,
				terms: (contractData as any).terms
			})
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

	const submitChangeRequest = async () => {
		if (!contract || !changeRequest.trim()) {
			setError('Please describe the changes you would like to request')
			return
		}
		try {
			setSubmitting(true)
			setError(null)
			await (supabase as any).rpc('log_contract_event', {
				p_contract_id: contract.id,
				p_event: 'change_requested',
				p_new_values: { change_type: changeType, priority: priority, request_details: changeRequest, requested_by: user?.id as string }
			})
			await (supabase as any).rpc('create_contract_notification', {
				p_contract_id: contract.id,
				p_recipient_id: contract.owner?.id || null,
				p_notification_type: 'change_request',
				p_title: 'Contract Change Request',
				p_message: `Vendor has requested changes to contract "${contract.title}". Please review the request.`
			})
			await supabase
				.from('service_contracts')
				.update({ vendor_notes: changeRequest, updated_at: new Date().toISOString() })
				.eq('id', contract.id)
			router.push(`/dashboard/vendor/contracts/view?id=${contract.id}`)
		} catch (error) {
			console.error('Error submitting change request:', error)
			setError('Failed to submit change request. Please try again.')
		} finally {
			setSubmitting(false)
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

	const getChangeTypeLabel = (type: string) => {
		switch (type) {
			case 'terms': return 'Contract Terms'
			case 'schedule': return 'Timeline/Schedule'
			case 'scope': return 'Scope of Work'
			case 'pricing': return 'Pricing/Financial'
			case 'other': return 'Other'
			default: return type
		}
	}

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case 'low': return 'bg-gray-100 text-gray-600'
			case 'medium': return 'bg-blue-100 text-blue-600'
			case 'high': return 'bg-orange-100 text-orange-600'
			case 'urgent': return 'bg-red-100 text-red-600'
			default: return 'bg-gray-100 text-gray-600'
		}
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
						<button onClick={() => router.back()} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Go Back</button>
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
													<button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="h-5 w-5 text-gray-700" /></button>
						<div className="flex-1">
							<h1 className="text-xl font-bold text-gray-900">Request Changes</h1>
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
						<h3 className="font-semibold text-gray-900 mb-3">Type of Change</h3>
						<div className="grid grid-cols-2 gap-2">
							{(['terms', 'schedule', 'scope', 'pricing', 'other'] as const).map((type) => (
								<label key={type} className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${changeType === type ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
									<input type="radio" name="changeType" value={type} checked={changeType === type} onChange={(e) => setChangeType(e.target.value as any)} className="text-blue-600" />
									<div className="text-sm">
										<div className="font-medium text-gray-900">{getChangeTypeLabel(type)}</div>
									</div>
								</label>
							))}
						</div>
					</div>

					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<h3 className="font-semibold text-gray-900 mb-3">Priority Level</h3>
						<div className="space-y-2">
							{(['low', 'medium', 'high', 'urgent'] as const).map((level) => (
								<label key={level} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
									<input type="radio" name="priority" value={level} checked={priority === level} onChange={(e) => setPriority(e.target.value as any)} className="text-blue-600" />
									<span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(level)}`}>{level.charAt(0).toUpperCase() + level.slice(1)}</span>
									<div className="text-sm text-gray-700">
										{level === 'low' && 'Can be addressed later'}
										{level === 'medium' && 'Should be addressed soon'}
										{level === 'high' && 'Needs immediate attention'}
										{level === 'urgent' && 'Critical - affects work progress'}
									</div>
								</label>
							))}
						</div>
					</div>

					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<h3 className="font-semibold text-gray-900 mb-3">Describe Your Request</h3>
						<div className="space-y-3">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Detailed Description</label>
								<textarea value={changeRequest} onChange={(e) => setChangeRequest(e.target.value)} placeholder="Please provide a detailed description of the changes you would like to request..." rows={6} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
							</div>
							<div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
								<h4 className="text-sm font-medium text-blue-900 mb-2">Tips for a Good Change Request:</h4>
								<ul className="text-xs text-blue-700 space-y-1">
									<li>• Be specific about what needs to change</li>
									<li>• Explain why the change is necessary</li>
									<li>• Suggest alternatives if possible</li>
									<li>• Consider the impact on timeline and cost</li>
								</ul>
							</div>
						</div>
					</div>

					{error && (<div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-sm text-red-600">{error}</p></div>)}

					<div className="space-y-3">
						<button onClick={submitChangeRequest} disabled={!changeRequest.trim() || submitting} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2">
							{ submitting ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>Submitting...</>) : (<><MessageSquare className="h-4 w-4" />Submit Change Request</>) }
						</button>
						<button onClick={() => router.back()} className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300">Cancel</button>
					</div>
				</main>
				<BottomNavbar userRole="vendor" />
			</div>
		</ProtectedRoute>
	)
}

export default function VendorContractRequestChangesPage() {
  return (
    <Suspense fallback={<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden"><div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div></div>}>
      <VendorContractRequestChangesPageInner />
    </Suspense>
  )
}


