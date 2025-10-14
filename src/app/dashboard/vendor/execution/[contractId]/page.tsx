'use client'

import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play, Pause, CheckCircle, Camera } from 'lucide-react'

type ExecutionData = {
	id: string
	status: string
	start_at: string | null
	end_at: string | null
	sla_window_start: string | null
	sla_window_end: string | null
	notes: string | null
	created_at: string
	contract: {
		id: string
		title: string | null
		status?: string | null
		start_date?: string | null
		end_date?: string | null
		vendor_id?: string | null
		property: { id: string; title: string | null; address: string | null } | null
		owner: { id: string; full_name: string | null } | null
		signatures?: { signer_role: string | null; signed_at: string | null }[]
		po?: { id: string; status: string | null }[]
	} | null
	attachments: {
		id: string
		url: string
		kind: string
	}[]
}

type ContractInfo = {
	id: string
	title: string | null
	status?: string | null
	start_date?: string | null
	end_date?: string | null
	vendor_id?: string | null
	property: { id: string; title: string | null; address: string | null } | null
	owner: { id: string; full_name: string | null } | null
	signatures?: { signer_role: string | null; signed_at: string | null }[]
	po?: { id: string; status: string | null }[]
}

export default function VendorExecutionPage() {
	const { contractId } = useParams<{ contractId: string }>()
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [execution, setExecution] = useState<ExecutionData | null>(null)
	const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null)
	const [updating, setUpdating] = useState(false)
	const [notes, setNotes] = useState('')
	const [uploading, setUploading] = useState(false)

	useEffect(() => {
		const load = async () => {
			if (!contractId) return
			setLoading(true)
			setError(null)
			try {
				const { data, error } = await supabase
					.from('job_executions')
					.select(`
						id,
						status,
						start_at,
						end_at,
						sla_window_start,
						sla_window_end,
						notes,
						created_at,
						contract:service_contracts(
							id,
							title,
							status,
							start_date,
							end_date,
							vendor_id,
							property:properties(id, title, address),
							owner:profiles!service_contracts_owner_id_fkey(id, full_name),
							signatures:service_contract_signatures(signer_role, signed_at),
							po:purchase_orders(id, status)
						),
						attachments:job_attachments(
							id,
							url,
							kind
						)
					`)
					.eq('contract_id', contractId)
					.single()

				if (error) {
					// Handle 0-row case gracefully (e.g., 406 Not Acceptable from PostgREST single())
					const msg = (error as any)?.message || ''
					if (msg.includes('406') || msg.toLowerCase().includes('no rows') || (error as any)?.code === 'PGRST116') {
						// Fetch contract info for gating Start Job
						const { data: cData, error: cErr } = await supabase
							.from('service_contracts')
							.select(`
								id,
								title,
								status,
								start_date,
								end_date,
								vendor_id,
								property:properties(id, title, address),
								owner:profiles!service_contracts_owner_id_fkey(id, full_name),
								signatures:service_contract_signatures(signer_role, signed_at),
								po:purchase_orders(id, status)
							`)
							.eq('id', contractId)
							.single()
						if (cErr) throw cErr
						setContractInfo(cData as ContractInfo)
						setExecution(null)
						setNotes('')
					} else {
						throw error
					}
				} else {
					setExecution(data as ExecutionData)
					setContractInfo(null)
					setNotes(data?.notes || '')
				}
			} catch (e) {
				setError(e instanceof Error ? e.message : 'Failed to load execution data')
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [contractId])

	const hasOwnerSignature = useMemo(() => {
		const roles = (execution?.contract?.signatures || contractInfo?.signatures || [])
			.map(s => (s.signer_role || '').toLowerCase())
		return roles.includes('owner')
	}, [execution, contractInfo])

	const hasVendorSignature = useMemo(() => {
		const roles = (execution?.contract?.signatures || contractInfo?.signatures || [])
			.map(s => (s.signer_role || '').toLowerCase())
		return roles.includes('vendor')
	}, [execution, contractInfo])

	const hasPO = useMemo(() => {
		const poList = execution?.contract?.po || contractInfo?.po || []
		return poList.length > 0
	}, [execution, contractInfo])

	const withinDateWindow = useMemo(() => {
		const startStr = execution?.contract?.start_date || contractInfo?.start_date || null
		const endStr = execution?.contract?.end_date || contractInfo?.end_date || null
		const start = startStr ? new Date(startStr) : null
		const end = endStr ? new Date(endStr) : null
		const now = new Date()
		if (start && now < start) return false
		if (end && now > end) return false
		return true
	}, [execution, contractInfo])

	const canStartJob = useMemo(() => {
		return hasOwnerSignature && hasVendorSignature && hasPO && withinDateWindow
	}, [hasOwnerSignature, hasVendorSignature, hasPO, withinDateWindow])

	const startJob = async () => {
		if (!contractId) return
		if (!canStartJob) {
			alert('Cannot start job yet. Ensure PO issued, both signatures present, and within scheduled window.')
			return
		}
		setUpdating(true)
		try {
			// Try to find existing execution first
			const { data: existing, error: existingErr } = await supabase
				.from('job_executions')
				.select('id,status,start_at')
				.eq('contract_id', contractId)
				.maybeSingle()

			if (existingErr) throw existingErr

			if (!existing) {
				const { error: insertErr } = await supabase
					.from('job_executions')
					.insert({ contract_id: contractId, status: 'in_progress', start_at: new Date().toISOString() })
				if (insertErr) throw insertErr
			} else {
				const { error: updateErr } = await supabase
					.from('job_executions')
					.update({ status: 'in_progress', start_at: existing.start_at || new Date().toISOString() })
					.eq('id', existing.id)
				if (updateErr) throw updateErr
			}

			// Optional: notify owner (best-effort)
            try {
                await supabase.rpc('create_contract_notification', {
                    p_contract_id: contractId,
                    p_recipient_id: execution?.contract?.owner?.id || '',
                    p_notification_type: 'status_change',
                    p_title: 'Job started',
                    p_message: 'Vendor has started the job.'
                })
			} catch (notifyErr) {
				console.warn('Notification failed', notifyErr)
			}

			// Reload
			const { data, error: reloadError } = await supabase
				.from('job_executions')
				.select(`
					id,
					status,
					start_at,
					end_at,
					sla_window_start,
					sla_window_end,
					notes,
					created_at,
					contract:service_contracts(
						id,
						title,
						status,
						start_date,
						end_date,
						vendor_id,
						property:properties(id, title, address),
						owner:profiles!service_contracts_owner_id_fkey(id, full_name),
						signatures:service_contract_signatures(signer_role, signed_at),
						po:purchase_orders(id, status)
					),
					attachments:job_attachments(
						id,
						url,
						kind
					)
				`)
				.eq('contract_id', contractId)
				.single()
			if (reloadError) throw reloadError
			setExecution(data as ExecutionData)
		} catch (e) {
			alert(`Failed to start job: ${e instanceof Error ? e.message : 'Unknown error'}`)
		} finally {
			setUpdating(false)
		}
	}

	const updateExecutionStatus = async (newStatus: string) => {
		if (!execution?.id) return
		
		setUpdating(true)
		try {
			const updateData: any = { status: newStatus }
			
			if (newStatus === 'in_progress' && !execution.start_at) {
				updateData.start_at = new Date().toISOString()
			} else if (newStatus === 'completed' && !execution.end_at) {
				updateData.end_at = new Date().toISOString()
			}
			
			if (notes.trim()) {
				updateData.notes = notes.trim()
			}

			const { error } = await supabase
				.from('job_executions')
				.update(updateData)
				.eq('id', execution.id)

			if (error) throw error

			// Optional: notify owner (best-effort)
			try {
				let title = 'Job updated'
				if (newStatus === 'paused') title = 'Job paused'
				else if (newStatus === 'in_progress') title = 'Job resumed'
				else if (newStatus === 'completed') title = 'Job completed'
                await supabase.rpc('create_contract_notification', {
                    p_contract_id: execution.contract?.id || '',
                    p_recipient_id: execution.contract?.owner?.id || '',
                    p_notification_type: 'status_change',
                    p_title: title,
                    p_message: notes?.trim() ? notes.trim() : ''
                })
			} catch (notifyErr) {
				console.warn('Notification failed', notifyErr)
			}

			// Reload execution data
			const { data, error: reloadError } = await supabase
				.from('job_executions')
				.select(`
					id,
					status,
					start_at,
					end_at,
					sla_window_start,
					sla_window_end,
					notes,
					created_at,
					contract:service_contracts(
						id,
						title,
						property:properties(id, title, address),
						owner:profiles!service_contracts_owner_id_fkey(id, full_name)
					),
					attachments:job_attachments(
						id,
						url,
						kind
					)
				`)
				.eq('contract_id', contractId)
				.single()

			if (reloadError) throw reloadError
			setExecution(data as ExecutionData)
		} catch (e) {
			alert(`Failed to update execution: ${e instanceof Error ? e.message : 'Unknown error'}`)
		} finally {
			setUpdating(false)
		}
	}

	const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, kind: 'before' | 'after') => {
		const file = event.target.files?.[0]
		if (!file || !execution?.id) return

		setUploading(true)
		try {
			// Upload to Supabase Storage
			const fileExt = file.name.split('.').pop()
			const fileName = `${execution.id}/${kind}_${Date.now()}.${fileExt}`
			
			const { error: uploadError } = await supabase.storage
				.from('job-attachments')
				.upload(fileName, file)

			if (uploadError) throw uploadError

			// Get public URL
			const { data: urlData } = supabase.storage
				.from('job-attachments')
				.getPublicUrl(fileName)

			// Save attachment record
			const { error: insertError } = await supabase
				.from('job_attachments')
				.insert({
					execution_id: execution.id,
					url: urlData.publicUrl,
					kind: kind
				})

			if (insertError) throw insertError

			// Reload execution data
			const { data, error: reloadError } = await supabase
				.from('job_executions')
				.select(`
					id,
					status,
					start_at,
					end_at,
					sla_window_start,
					sla_window_end,
					notes,
					created_at,
					contract:service_contracts(
						id,
						title,
						property:properties(id, title, address),
						owner:profiles!service_contracts_owner_id_fkey(id, full_name)
					),
					attachments:job_attachments(
						id,
						url,
						kind
					)
				`)
				.eq('contract_id', contractId)
				.single()

			if (reloadError) throw reloadError
			setExecution(data as ExecutionData)
		} catch (e) {
			alert(`Failed to upload file: ${e instanceof Error ? e.message : 'Unknown error'}`)
		} finally {
			setUploading(false)
		}
	}

	const formatDate = (dateString: string | null) => {
		return dateString ? new Date(dateString).toLocaleString() : '-'
	}

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'not_started': return 'bg-gray-100 text-gray-700'
			case 'in_progress': return 'bg-blue-100 text-blue-700'
			case 'paused': return 'bg-yellow-100 text-yellow-700'
			case 'completed': return 'bg-green-100 text-green-700'
			default: return 'bg-gray-100 text-gray-700'
		}
	}

	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'in_progress': return <Play className="w-4 h-4" />
			case 'paused': return <Pause className="w-4 h-4" />
			case 'completed': return <CheckCircle className="w-4 h-4" />
			default: return null
		}
	}

	return (
		<ProtectedRoute allowedRoles={['vendor']}>
			<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden">
				{/* Dark Header */}
				<div className="px-4 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500">
					<div className="max-w-sm mx-auto text-white">
						<div className="flex items-center gap-3">
							<Link href="/dashboard/vendor/jobs" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
								<ArrowLeft className="w-5 h-5 text-white" />
							</Link>
							<div className="text-xl font-bold">Job Execution</div>
						</div>
					</div>
				</div>

				<div className="max-w-sm mx-auto p-4 space-y-4">
				
				{loading && <div>Loading...</div>}
				{error && <div className="text-red-600 text-sm">{error}</div>}
				
				{!loading && !error && execution && (
					<>
						{/* Job Info */}
						<div className="bg-white rounded-xl border p-5 shadow-md">
							<div className="flex items-center justify-between mb-3">
								<div>
									<div className="text-lg font-semibold text-gray-900">{execution.contract?.title || 'Job'}</div>
									<div className="text-sm text-gray-700">{execution.contract?.property?.title || 'Property'}</div>
								</div>
								<div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${getStatusColor(execution.status)}`}>
									{getStatusIcon(execution.status)}
									{execution.status.replace('_', ' ')}
								</div>
							</div>
							
							<div className="space-y-2 text-sm text-gray-900">
								<div><span className="font-medium">Property:</span> {execution.contract?.property?.address || '—'}</div>
								<div><span className="font-medium">Owner:</span> {execution.contract?.owner?.full_name || '—'}</div>
								<div><span className="font-medium">Started:</span> {formatDate(execution.start_at)}</div>
								{execution.end_at && (
									<div><span className="font-medium">Completed:</span> {formatDate(execution.end_at)}</div>
								)}
							</div>
						</div>

						{/* Status Actions */}
						<div className="bg-white rounded-xl border p-5 shadow-md">
							<div className="text-base font-semibold text-gray-900 mb-3">Job Actions</div>
							<div className="grid grid-cols-2 gap-4">
								{execution.status === 'not_started' && (
									<button
										onClick={() => updateExecutionStatus('in_progress')}
										disabled={updating}
										className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
									>
										<Play className="w-4 h-4" />
										Start Job
									</button>
								)}
								
								{execution.status === 'in_progress' && (
									<>
										<button
											onClick={() => updateExecutionStatus('paused')}
											disabled={updating}
									className="flex items-center justify-center gap-2 h-10 px-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
										>
											<Pause className="w-4 h-4" />
											Pause
										</button>
										<button
											onClick={() => updateExecutionStatus('completed')}
											disabled={updating}
									className="flex items-center justify-center gap-2 h-10 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
										>
											<CheckCircle className="w-4 h-4" />
											Complete
										</button>
									</>
								)}
								
								{execution.status === 'paused' && (
									<button
										onClick={() => updateExecutionStatus('in_progress')}
										disabled={updating}
									className="flex items-center justify-center gap-2 h-10 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
									>
										<Play className="w-4 h-4" />
										Resume
									</button>
								)}
								
								{execution.status === 'completed' && (
									<button
										onClick={() => window.location.href = `/dashboard/vendor/closure/${contractId}`}
										className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
									>
										<CheckCircle className="w-4 h-4" />
										Submit Closure
									</button>
								)}
							</div>
						</div>

						{/* Notes */}
						<div className="bg-white rounded-xl border p-5 shadow-md">
							<div className="text-base font-semibold text-gray-900 mb-3">Job Notes</div>
							<textarea
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								placeholder="Add notes about the job progress..."
								className="w-full p-3 border border-gray-300 rounded-lg resize-none text-gray-900 placeholder-gray-500"
								rows={3}
							/>
							<button
								onClick={() => updateExecutionStatus(execution.status)}
								disabled={updating}
								className="mt-3 h-10 px-4 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50"
							>
								Save Notes
							</button>
						</div>

						{/* Photo Attachments */}
						<div className="bg-white rounded-xl border p-5 shadow-md">
							<div className="text-base font-semibold text-gray-900 mb-3">Job Photos</div>
							
							<div className="grid grid-cols-2 gap-4 mb-4 text-gray-900">
								<div>
									<div className="text-xs text-gray-600 mb-2">Before Photos</div>
									<input
										type="file"
										accept="image/*"
										onChange={(e) => handleFileUpload(e, 'before')}
										disabled={uploading}
										className="hidden"
										id="before-upload"
									/>
									<label
										htmlFor="before-upload"
										className="flex items-center justify-center gap-2 h-10 px-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 bg-gray-50 disabled:opacity-50"
									>
										<Camera className="w-4 h-4" />
										<span className="text-sm">Add Before</span>
									</label>
								</div>
								
								<div>
									<div className="text-xs text-gray-600 mb-2">After Photos</div>
									<input
										type="file"
										accept="image/*"
										onChange={(e) => handleFileUpload(e, 'after')}
										disabled={uploading}
										className="hidden"
										id="after-upload"
									/>
									<label
										htmlFor="after-upload"
										className="flex items-center justify-center gap-2 h-10 px-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 bg-gray-50 disabled:opacity-50"
									>
										<Camera className="w-4 h-4" />
										<span className="text-sm">Add After</span>
									</label>
								</div>
							</div>

							{/* Display Attachments */}
							{execution.attachments && execution.attachments.length > 0 && (
								<div className="space-y-3">
									<div className="text-xs text-gray-600">Uploaded Photos</div>
									<div className="grid grid-cols-2 gap-2">
										{execution.attachments.map((attachment) => (
											<div key={attachment.id} className="relative">
												<img
													src={attachment.url}
													alt={`${attachment.kind} photo`}
													className="w-full h-24 object-cover rounded-lg"
												/>
												<div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
													{attachment.kind}
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</>
				)}

				{/* If no execution yet, allow guarded start based on Urban Company flow */}
				{!loading && !error && !execution && (
					<div className="bg-white rounded-lg border p-4 space-y-3">
						<div className="text-sm">No execution started yet.</div>
						<ul className="text-xs text-gray-600 list-disc pl-5 space-y-1">
							<li>PO must be issued</li>
							<li>Owner and Vendor must have signed</li>
							<li>Must be within the scheduled window</li>
						</ul>
						<button
							onClick={startJob}
							disabled={!canStartJob || updating}
							className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
						>
							<Play className="w-4 h-4" />
							Start Job
						</button>
						{!canStartJob && (
							<div className="text-xs text-red-600">
								Cannot start yet. Ensure PO issued, both signatures present, and within schedule.
							</div>
						)}
					</div>
				)}
				</div>
			</div>
		</ProtectedRoute>
	)
}
