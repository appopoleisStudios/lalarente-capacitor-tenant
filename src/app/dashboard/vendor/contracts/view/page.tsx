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
	Calendar, 
	DollarSign, 
	Clock, 
	MapPin,
	User,
	Building,
	Tag
} from 'lucide-react'

type ContractStatus = 'draft' | 'pending_signatures' | 'active' | 'completed' | 'terminated' | 'expired'
type ContractType = 'maintenance' | 'retainer' | 'project' | 'emergency'
type ContractPriority = 'low' | 'medium' | 'high' | 'urgent'

interface ContractDocument {
	id: string
	document_type: string
	file_name: string
	file_url: string
	file_size: number | null
	mime_type: string | null
	uploaded_at: string
	uploaded_by: {
		id: string
		full_name: string
	} | null
	version: number
	is_primary: boolean
	notes: string | null
}

interface ContractNotification {
	id: string
	notification_type: string
	title: string
	message: string
	is_read: boolean
	created_at: string
}

interface ContractAuditLog {
	id: string
	event: string
	actor: {
		id: string
		full_name: string
	} | null
	old_values: any
	new_values: any
	created_at: string
}

interface VendorContract {
	id: string
	title: string
	status: ContractStatus
	contract_type: ContractType
	priority: ContractPriority
	contract_value: number | null
	sla_hours: number | null
	renewal_date: string | null
	auto_renew: boolean
	termination_notice_days: number | null
	vendor_notes: string | null
	owner_notes: string | null
	estimated_duration_hours: number | null
	actual_duration_hours: number | null
	start_date: string | null
	end_date: string | null
	completion_date: string | null
	vendor_rating: number | null
	vendor_feedback: string | null
	owner_rating: number | null
	owner_feedback: string | null
	created_at: string
	updated_at: string
	property: {
		id: string
		title: string
		address: string
		city: string
		province: string
		postal_code: string
		country: string
	} | null
	owner: {
		id: string
		full_name: string
		email: string
		phone: string | null
	} | null
	tenant: {
		id: string
		full_name: string
		email: string
		phone: string | null
	} | null
	documents: ContractDocument[]
	notifications: ContractNotification[]
	audit_logs: ContractAuditLog[]
}

function VendorContractDetailPageInner() {
	const searchParams = useSearchParams()
	const router = useRouter()
	const { user, profile } = useAuthStore()
	const id = searchParams.get('id')

	const [contract, setContract] = useState<VendorContract | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [sigs, setSigs] = useState<{ signer_role: string; signed_at: string }[]>([])

	const loadContract = useCallback(async () => {
		if (!user || !id) return

		try {
			setLoading(true)
			setError(null)

			console.log('Loading contract with ID:', id)
			console.log('Current user ID:', user.id)

			// First, let's check if the contract exists at all
			const { data: contractExists, error: existsError } = await supabase
				.from('service_contracts')
				.select('id, vendor_id')
				.eq('id', id)
				.single()

			if (existsError) {
				console.error('Contract existence check failed:', existsError)
				if (existsError.code === 'PGRST116') {
					setError('Contract not found')
				} else {
					setError(`Database error: ${existsError.message}`)
				}
				return
			}

			console.log('Contract exists:', contractExists)

			// Check if the current user is the vendor for this contract
			if (contractExists.vendor_id !== user.id) {
				console.error('User is not the vendor for this contract')
				setError('You do not have access to this contract')
				return
			}

			// Simple base contract load (joins may be blocked by RLS)
			let contractData: any = null
			{
				const { data: baseData, error: baseError } = await supabase
					.from('service_contracts')
					.select('*')
					.eq('id', id)
					.eq('vendor_id', user.id)
					.single()
				if (baseError || !baseData) {
					console.error('Base contract load error:', baseError)
					throw (baseError as any) || new Error('Failed to load contract')
				}
				contractData = baseData
			}

			console.log('Contract data loaded:', contractData)

			// Load property data (direct query to avoid RLS), non-fatal on failure
			let propertyData = null
			try {
				// Direct query first
				const { data: property, error: propertyError } = await supabase
					.from('properties')
					.select('id, title, address, city, province, postal_code')
					.eq('id', (contractData as any).property_id)
					.single()
				if (!propertyError) {
					propertyData = property
				}
			} catch (err) {
				console.warn('Property data load non-fatal:', err)
			}

			// Load owner data (direct query), non-fatal on failure
			let ownerData = null
			try {
				const { data: owner, error: ownerError } = await supabase
					.from('profiles')
					.select('id, full_name, email, phone')
					.eq('id', (contractData as any).owner_id)
					.single()
				if (!ownerError) {
					ownerData = owner
				}
			} catch (err) {
				console.warn('Owner data load non-fatal:', err)
			}

			// Load tenant data (direct query), tenant optional
			let tenantData = null
			if (contractData.tenant_id) {
				try {
					const { data: tenant, error: tenantError } = await supabase
						.from('profiles')
						.select('id, full_name, email, phone')
						.eq('id', (contractData as any).tenant_id)
						.single()
					if (!tenantError) {
						tenantData = tenant
					}
				} catch (err) {
					console.warn('Tenant data load non-fatal:', err)
					// Don't throw for tenant - it's optional
				}
			}

			// Load documents (type assertion for missing table)
			const { data: documentsData, error: docError } = await (supabase as any)
				.from('contract_documents')
				.select(`
					*,
					uploaded_by:profiles(id, full_name)
				`)
				.eq('contract_id', id)
				.order('uploaded_at', { ascending: false })

			if (docError) {
				console.error('Documents load error:', docError)
			}

			// Load notifications (type assertion for missing table)
			const { data: notificationsData, error: notifError } = await (supabase as any)
				.from('contract_notifications')
				.select('*')
				.eq('contract_id', id)
				.order('created_at', { ascending: false })

			if (notifError) {
				console.error('Notifications load error:', notifError)
			}

			// Load audit logs (type assertion for missing table)
			const { data: auditLogsData, error: auditError } = await (supabase as any)
				.from('contract_management_audit_logs')
				.select(`
					*,
					actor:profiles(id, full_name)
				`)
				.eq('contract_id', id)
				.order('created_at', { ascending: false })

			if (auditError) {
				console.error('Audit logs load error:', auditError)
			}

			// Load signatures (drive timeline UI)
			const { data: sigsData, error: sigsError } = await supabase
				.from('service_contract_signatures')
				.select('signer_role,signed_at')
				.eq('contract_id', id)
				.order('signed_at', { ascending: true })
			if (sigsError) {
				console.error('Signatures load error:', sigsError)
			} else {
				setSigs(sigsData || [])
			}

			setContract({
				...contractData,
				property: propertyData,
				owner: ownerData,
				tenant: tenantData,
				documents: documentsData || [],
				notifications: notificationsData || [],
				audit_logs: auditLogsData || []
			})
		} catch (err) {
			console.error('Error loading contract:', err)
			setError('Failed to load contract details')
		} finally {
			setLoading(false)
		}
	}, [user, id])

	useEffect(() => {
		loadContract()
	}, [loadContract])

	const formatCurrency = (amount: number | null) => {
		if (!amount) return 'Not specified'
		return new Intl.NumberFormat('en-ZA', {
			style: 'currency',
			currency: 'ZAR'
		}).format(amount)
	}

	const formatDate = (dateString: string | null) => {
		if (!dateString) return 'Not specified'
		return new Date(dateString).toLocaleDateString('en-ZA', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		})
	}

	const getStatusColor = (status: ContractStatus) => {
		switch (status) {
			case 'draft': return 'bg-gray-100 text-gray-700'
			case 'pending_signatures': return 'bg-yellow-100 text-yellow-700'
			case 'active': return 'bg-green-100 text-green-700'
			case 'completed': return 'bg-blue-100 text-blue-700'
			case 'terminated': return 'bg-red-100 text-red-700'
			case 'expired': return 'bg-gray-100 text-gray-700'
			default: return 'bg-gray-100 text-gray-700'
		}
	}

	const getTypeColor = (type: ContractType) => {
		switch (type) {
			case 'maintenance': return 'bg-blue-100 text-blue-700'
			case 'retainer': return 'bg-purple-100 text-purple-700'
			case 'project': return 'bg-orange-100 text-orange-700'
			case 'emergency': return 'bg-red-100 text-red-700'
			default: return 'bg-gray-100 text-gray-700'
		}
	}

	const getPriorityColor = (priority: ContractPriority) => {
		switch (priority) {
			case 'low': return 'bg-green-100 text-green-700'
			case 'medium': return 'bg-yellow-100 text-yellow-700'
			case 'high': return 'bg-orange-100 text-orange-700'
			case 'urgent': return 'bg-red-100 text-red-700'
			default: return 'bg-gray-100 text-gray-700'
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

	if (error || !contract) {
		return (
			<ProtectedRoute allowedRoles={['vendor']}>
				<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden">
					<VendorHeader />
					<div className="text-center py-8">
						<h3 className="text-lg font-medium text-gray-900">Contract not found</h3>
						<p className="text-gray-500">The contract you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.</p>
					</div>
				</div>
			</ProtectedRoute>
		)
	}

	// Removed unused vendorHasSigned variable

	return (
		<ProtectedRoute allowedRoles={['vendor']}>
			<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden">
				<VendorHeader />
				
				<main className="px-4 py-4 space-y-4">
					{/* Header with Role Badge */}
					<div className="flex items-center gap-3 mb-4">
						<button
							onClick={() => router.back()}
							className="p-2 hover:bg-gray-100 rounded-lg"
						>
							<ArrowLeft className="h-5 w-5 text-gray-700" />
						</button>
						<div className="flex-1">
							<h1 className="text-xl font-bold text-gray-900">Contract Details</h1>
							<div className="flex items-center gap-2 mt-1">
								<span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
									Vendor
								</span>
								<span className="text-sm text-gray-600">• {contract.title}</span>
							</div>
						</div>
					</div>

					{/* Status Badge */}
					<div className="flex items-center gap-2 mb-4">
						<span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}>
							{contract.status.replace('_', ' ')}
						</span>
						<span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(contract.contract_type)}`}>
							{contract.contract_type}
						</span>
						<span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(contract.priority)}`}>
							{contract.priority}
						</span>
					</div>

					{/* Status Timeline (vertical, design-aligned) */}
					<div className="bg-white rounded-xl border p-4 mb-4">
						<div className="text-lg font-semibold text-gray-900 mb-4">Contract Progress</div>
						{(() => {
							type StepState = 'done' | 'current' | 'pending'
							const vendorSig = sigs.find(s => s.signer_role === 'vendor')
							const ownerSig = sigs.find(s => s.signer_role === 'owner')
							const activeState: StepState = (contract.status === 'active' || contract.status === 'completed') ? 'done' : 'pending'
							const vendorStep: { key: string; label: string; sub?: string; state: StepState; when?: string } = {
								key: 'signed_vendor',
								label: 'Signed by Vendor',
								...(vendorSig ? {} : { sub: 'Waiting for signature' }),
								state: vendorSig ? 'done' : 'pending',
								...(vendorSig?.signed_at ? { when: vendorSig.signed_at } : {}),
							}
							const ownerStep: { key: string; label: string; sub?: string; state: StepState; when?: string } = {
								key: 'signed_owner',
								label: 'Signed by Owner',
								...(ownerSig ? {} : { sub: 'Waiting for signature' }),
								state: ownerSig ? 'done' : 'pending',
								...(ownerSig?.signed_at ? { when: ownerSig.signed_at } : {}),
							}
							const vendorFirst = !!vendorSig && !ownerSig
                            const steps = [
								{ key: 'created', label: 'Created', state: 'done' as StepState },
								{ key: 'sent', label: 'Sent', state: 'done' as StepState },
								vendorFirst ? vendorStep : ownerStep,
								vendorFirst ? ownerStep : vendorStep,
                              { key: 'active', label: 'Active', ...(activeState === 'pending' ? { sub: 'Pending' } : {}), state: activeState },
							]
							const StepIcon = ({ state }: { state: StepState }) => {
								if (state === 'done') return <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">✓</div>
								if (state === 'current') return <div className="w-6 h-6 rounded-full bg-amber-500/90 text-white flex items-center justify-center"><span className="w-2 h-2 bg-white rounded-full" /></div>
								return <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center"><span className="w-2 h-2 bg-gray-400 rounded-full" /></div>
							}
							return (
								<div className="relative">
									<div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
									<div className="space-y-6">
										{steps.map((st, idx) => (
											<div key={st.key} className="relative pl-8">
												{idx > 0 && <div className={`absolute left-3 -top-3 w-px h-3 ${st.state === 'done' ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
												{idx < steps.length - 1 && <div className={`absolute left-3 top-6 w-px h-6 ${st.state === 'done' ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
												<div className="absolute left-0 top-0"><StepIcon state={st.state} /></div>
												<div>
													<div className={`font-medium ${st.state === 'pending' ? 'text-gray-500' : 'text-gray-900'}`}>{st.label}</div>
													{st.sub && <div className={`${st.state === 'current' ? 'text-amber-600' : 'text-gray-500'} text-sm`}>{st.sub}</div>}
													{st.state === 'done' && (st as any).when && (
														<div className="text-xs text-gray-500">{new Date((st as any).when).toLocaleString()}</div>
													)}
												</div>
											</div>
										))}
									</div>
								</div>
							)
						})()}
					</div>

					{/* Contract Summary Card */}
					<div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
						<h3 className="font-semibold text-gray-900 mb-3">Contract Summary</h3>
						<div className="space-y-3 text-sm">
							<div className="flex items-center gap-2">
								<Building className="h-4 w-4 text-gray-500" />
								<span className="text-gray-700">Property:</span>
								<span className="font-medium text-gray-900">{contract.property?.title}</span>
							</div>
							<div className="flex items-center gap-2">
								<MapPin className="h-4 w-4 text-gray-500" />
								<span className="text-gray-700">Address:</span>
								<span className="font-medium text-gray-900">{contract.property?.address}</span>
							</div>
							<div className="flex items-center gap-2">
								<Calendar className="h-4 w-4 text-gray-500" />
								<span className="text-gray-700">Created:</span>
								<span className="font-medium text-gray-900">{formatDate(contract.created_at)}</span>
							</div>
							<div className="flex items-center gap-2">
								<Tag className="h-4 w-4 text-gray-500" />
								<span className="text-gray-700">Contract ID:</span>
								<span className="font-medium text-gray-900">#{contract.id.slice(0, 8)}</span>
							</div>
						</div>
					</div>

					{/* Service Summary Card */}
					<div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
						<h3 className="font-semibold text-gray-900 mb-3">Service Summary</h3>
						<div className="space-y-3 text-sm">
							<div className="flex items-center gap-2">
								<Tag className="h-4 w-4 text-gray-500" />
								<span className="text-gray-700">Service Type:</span>
								<span className="font-medium text-gray-900">{contract.contract_type}</span>
							</div>
							<div className="flex items-center gap-2">
								<DollarSign className="h-4 w-4 text-gray-500" />
								<span className="text-gray-700">Contract Value:</span>
								<span className="font-medium text-gray-900">{formatCurrency(contract.contract_value)}</span>
							</div>
							<div className="flex items-center gap-2">
								<Clock className="h-4 w-4 text-gray-500" />
								<span className="text-gray-700">SLA:</span>
								<span className="font-medium text-gray-900">{contract.sla_hours || 'Not set'} hours</span>
							</div>
							{contract.estimated_duration_hours && (
								<div className="flex items-center gap-2">
									<Clock className="h-4 w-4 text-gray-500" />
									<span className="text-gray-700">Estimated Duration:</span>
									<span className="font-medium text-gray-900">{contract.estimated_duration_hours} hours</span>
								</div>
							)}
						</div>
					</div>

					{/* Parties Card */}
					<div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
						<h3 className="font-semibold text-gray-900 mb-3">Contract Parties</h3>
						<div className="space-y-3">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
									<User className="w-5 h-5 text-blue-600" />
								</div>
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<span className="font-medium text-gray-900">{contract.owner?.full_name || 'Unknown owner'}</span>
										<span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
											Owner
										</span>
									</div>
									<p className="text-sm text-gray-600">{contract.owner?.email || 'No email available'}</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
									<User className="w-5 h-5 text-indigo-600" />
								</div>
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<span className="font-medium text-gray-900">{profile?.full_name || 'Vendor'}</span>
										<span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
											Vendor
										</span>
									</div>
									<p className="text-sm text-gray-600">{profile?.email || '—'}</p>
								</div>
							</div>
							{contract.tenant && (
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
										<User className="w-5 h-5 text-emerald-600" />
									</div>
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<span className="font-medium text-gray-900">{contract.tenant.full_name}</span>
											<span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
												Tenant
											</span>
										</div>
										<p className="text-sm text-gray-600">{contract.tenant.email || 'No email available'}</p>
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Recent Activity */}
					<div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
						<h3 className="font-semibold text-gray-900 mb-3">Recent Activity</h3>
						<div className="space-y-3">
							{contract.audit_logs?.slice(0, 5).map((log) => (
								<div key={log.id} className="flex items-start gap-3">
									<div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
									<div className="flex-1">
										<p className="text-sm text-gray-900">{log.event.replace('_', ' ')}</p>
										<p className="text-xs text-gray-500">{formatDate(log.created_at)}</p>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Action Buttons */}
					{contract.status === 'pending_signatures' && (() => {
						const vendorSigned = sigs.some(s => s.signer_role === 'vendor')
						const ownerSigned = sigs.some(s => s.signer_role === 'owner')
						if (!vendorSigned) {
							return (
								<div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
									<h3 className="font-semibold text-gray-900 mb-3">Actions</h3>
									<div className="flex gap-3">
										<button
											onClick={() => router.push(`/dashboard/vendor/contracts/sign?id=${contract.id}`)}
											className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
										>
											Sign Contract
										</button>
										<button
											onClick={() => router.push(`/dashboard/vendor/contracts/request-changes?id=${contract.id}`)}
											className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-600"
										>
											Request Changes
										</button>
									</div>
								</div>
							)
						}
						if (vendorSigned && !ownerSigned) {
							return (
								<div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
									<h3 className="font-semibold text-gray-900 mb-3">Actions</h3>
									<p className="text-sm text-gray-600 mb-3">Waiting for owner signature. You can message the owner if there is any issue delaying the contract start.</p>
									<div className="flex gap-3">
										<button
											onClick={() => router.push(`/dashboard/vendor/contracts/message?id=${contract.id}`)}
											className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
										>
											Send Message to Owner
										</button>
									</div>
								</div>
							)
						}
						return null
					})()}

					{/* Documents Section */}
					<div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
						<h3 className="font-semibold text-gray-900 mb-3">Documents</h3>
						{contract.documents && contract.documents.length > 0 ? (
							<div className="space-y-3">
								{contract.documents.map((doc) => (
									<div key={doc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
										<div className="flex items-center gap-3">
            <span className="h-5 w-5 text-gray-500">📄</span>
											<div>
												<p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
												<p className="text-xs text-gray-500">
													{formatDate(doc.uploaded_at)} • {doc.uploaded_by?.full_name}
												</p>
											</div>
										</div>
										<button
											onClick={() => window.open(doc.file_url, '_blank')}
											className="text-blue-600 hover:text-blue-700 text-sm font-medium"
										>
											Download
										</button>
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-gray-500">No documents uploaded yet.</p>
						)}
					</div>
				</main>

				<BottomNavbar userRole="vendor" />
			</div>
		</ProtectedRoute>
	)
}

export default function VendorContractDetailPage() {
  return (
    <Suspense fallback={<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden"><div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div></div>}>
      <VendorContractDetailPageInner />
    </Suspense>
  )
}


