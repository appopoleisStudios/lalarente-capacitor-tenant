'use client'

import { useEffect, useState, useRef } from 'react'
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import VendorHeader from '@/components/Vendor/VendorHeader'
import BottomNavbar from '@/components/BottomNavbar'
import { ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react'

interface Contract {
	id: string
	title: string
	status: string
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
	compiled_html: string | null
}

function VendorContractSignPageInner() {
	const searchParams = useSearchParams()
	const id = searchParams.get('id')
	const router = useRouter()
	const { user } = useAuthStore()
	const [contract, setContract] = useState<Contract | null>(null)
	const [loading, setLoading] = useState(true)
	const [signing, setSigning] = useState(false)
	const [signatureFile, setSignatureFile] = useState<File | null>(null)
	const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [isDrawing, setIsDrawing] = useState(false)
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		if (!user || !id) return
		loadContract()
	}, [user, id])

	const loadContract = async () => {
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

			if (contractData.status !== 'pending_signatures') {
				setError('This contract is not ready for signing')
				return
			}

			setContract({
				id: contractData.id,
				title: contractData.title,
				status: contractData.status,
				property: contractData.property || null,
				owner: contractData.owner || null,
				terms: contractData.terms,
				compiled_html: contractData.compiled_html || null
			})
		} catch (error) {
			console.error('Error loading contract:', error)
			setError('Failed to load contract')
		} finally {
			setLoading(false)
		}
	}

	const handleSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (!file) return
		if (!file.type.startsWith('image/')) {
			setError('Please upload an image file for your signature')
			return
		}
		const url = URL.createObjectURL(file)
		setSignatureUrl(url)
		setSignatureFile(file)
		setError(null)
	}

	const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
		setIsDrawing(true)
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		const rect = canvas.getBoundingClientRect()
		const x = e.clientX - rect.left
		const y = e.clientY - rect.top
		ctx.beginPath()
		ctx.moveTo(x, y)
	}

	const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
		if (!isDrawing) return
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		const rect = canvas.getBoundingClientRect()
		const x = e.clientX - rect.left
		const y = e.clientY - rect.top
		ctx.lineTo(x, y)
		ctx.stroke()
	}

	const stopDrawing = () => {
		setIsDrawing(false)
	}

	const clearCanvas = () => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		ctx.clearRect(0, 0, canvas.width, canvas.height)
	}

	const saveSignature = () => {
		const canvas = canvasRef.current
		if (!canvas) return
		canvas.toBlob((blob) => {
			if (blob) {
				const file = new File([blob], 'signature.png', { type: 'image/png' })
				setSignatureFile(file)
				setSignatureUrl(URL.createObjectURL(blob))
				setError(null)
			}
		}, 'image/png')
	}

	const signContract = async () => {
		if (!contract || !signatureFile) {
			setError('Please upload your signature')
			return
		}
		try {
			setSigning(true)
			setError(null)

			// Check if vendor has already signed this contract
			const { data: existingVendorSignature } = await (supabase as any)
				.from('service_contract_signatures')
				.select('id')
				.eq('contract_id', contract.id)
				.eq('signer_role', 'vendor')
				.eq('signer_id', user?.id)
				.single()

			if (existingVendorSignature) {
				setError('You have already signed this contract')
				return
			}

			const fileExt = signatureFile.name.split('.').pop()
			const fileName = `signature-${user?.id}-${Date.now()}.${fileExt}`
			const filePath = `contracts/${contract.id}/signatures/${fileName}`

			const { error: uploadError } = await supabase.storage
				.from('contracts')
				.upload(filePath, signatureFile)
			if (uploadError) throw uploadError

			const { data: urlData } = (supabase as any).storage
				.from('contracts')
				.getPublicUrl(filePath)

			const { error: insertError } = await (supabase as any)
				.from('service_contract_signatures')
				.insert({
					contract_id: contract.id,
					signer_role: 'vendor',
					signer_id: user?.id as string,
					signature_image_url: urlData.publicUrl,
					signed_at: new Date().toISOString(),
					ip_address: '127.0.0.1',
					user_agent: navigator.userAgent
				})
			if (insertError) throw insertError

			const { data: existingSignatures } = await (supabase as any)
				.from('service_contract_signatures')
				.select('signer_role')
				.eq('contract_id', contract.id)

			const hasOwnerSignature = existingSignatures?.some((s: any) => s.signer_role === 'owner')
			if (hasOwnerSignature) {
				await supabase
					.from('service_contracts')
					.update({ status: 'active' })
					.eq('id', contract.id)
				await (supabase as any).rpc('log_contract_event', {
					p_contract_id: contract.id,
					p_event: 'contract_activated',
					p_new_values: { status: 'active' }
				})
				await (supabase as any).rpc('create_contract_notification', {
					p_contract_id: contract.id,
					p_recipient_id: contract.owner?.id || null,
					p_notification_type: 'status_change',
					p_title: 'Contract Activated',
					p_message: `Contract "${contract.title}" has been activated. Both parties have signed.`
				})
			} else {
				await (supabase as any).rpc('log_contract_event', {
					p_contract_id: contract.id,
					p_event: 'vendor_signed',
					p_new_values: { signer_id: user?.id as string }
				})
				await (supabase as any).rpc('create_contract_notification', {
					p_contract_id: contract.id,
					p_recipient_id: contract.owner?.id || null,
					p_notification_type: 'status_change',
					p_title: 'Contract Ready for Your Signature',
					p_message: `Vendor has signed contract "${contract.title}". Please sign to activate.`
				})
			}

			router.push(`/dashboard/vendor/contracts/view?id=${contract.id}`)
		} catch (error) {
			console.error('Error signing contract:', error)
			setError(`Failed to sign contract: ${error instanceof Error ? error.message : 'Unknown error'}`)
		} finally {
			setSigning(false)
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
						<button
							onClick={() => router.back()}
							className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
						>
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
						<button
							onClick={() => router.back()}
							className="p-2 hover:bg-gray-100 rounded-lg"
						>
							<ArrowLeft className="h-5 w-5 text-gray-700" />
						</button>
						<div className="flex-1">
							<h1 className="text-xl font-bold text-gray-900">Sign Contract</h1>
							<p className="text-sm text-gray-600">{contract?.title}</p>
						</div>
					</div>

					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<h3 className="font-semibold text-gray-900 mb-3">Contract Details</h3>
						<div className="space-y-2 text-sm">
							<div>
								<span className="text-gray-700">Property:</span>
								<span className="ml-2 font-medium text-gray-900">{contract?.property?.title}</span>
							</div>
							<div>
								<span className="text-gray-700">Address:</span>
								<span className="ml-2 text-gray-900">{contract?.property?.address}</span>
							</div>
							<div>
								<span className="text-gray-700">Owner:</span>
								<span className="ml-2 font-medium text-gray-900">{contract?.owner?.full_name}</span>
							</div>
						</div>
					</div>

					{contract?.compiled_html && (
						<div className="bg-white border border-gray-200 rounded-lg p-4">
							<h3 className="font-semibold text-gray-900 mb-3">Contract Terms</h3>
							<div 
								className="prose prose-sm max-w-none"
								dangerouslySetInnerHTML={{ __html: contract.compiled_html }}
							/>
						</div>
					)}

					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<h3 className="font-semibold text-gray-900 mb-3">Your Signature</h3>
						<div className="space-y-4">
							{/* Option 1: Upload Signature Image */}
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Option 1: Upload Signature Image
								</label>
								<div className="w-full">
									<input
										type="file"
										accept="image/*"
										onChange={handleSignatureUpload}
										className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
									/>
								</div>
								<p className="mt-1 text-xs text-gray-500">
									Upload a clear image of your signature (PNG, JPG, or GIF)
								</p>
							</div>

							{/* Option 2: Draw Signature */}
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Option 2: Draw Your Signature
								</label>
								<div className="w-full">
									<canvas
										ref={canvasRef}
										width={300}
										height={150}
										className="border border-gray-300 rounded bg-white w-full max-w-md mb-2 cursor-crosshair"
										onMouseDown={startDrawing}
										onMouseMove={draw}
										onMouseUp={stopDrawing}
										onMouseLeave={stopDrawing}
									/>
									<div className="flex gap-2">
										<button
											onClick={clearCanvas}
											className="bg-gray-500 text-white px-3 py-1 rounded text-sm font-medium hover:bg-gray-600"
										>
											Clear
										</button>
										<button
											onClick={saveSignature}
											className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-blue-700"
										>
											Use This Signature
										</button>
									</div>
								</div>
							</div>

							{/* Option 3: Type Name for Auto-Signature */}
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Option 3: Type Your Name
								</label>
								<input
									type="text"
									placeholder="Enter your full name for automatic signature generation"
									className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								/>
								<p className="mt-1 text-xs text-gray-500">
									Your name will be converted to a signature font
								</p>
							</div>

							{signatureUrl && (
								<div className="border border-gray-200 rounded-lg p-3">
									<p className="text-sm font-medium text-gray-700 mb-2">Signature Preview:</p>
									<img 
										src={signatureUrl} 
										alt="Signature preview" 
										className="max-w-full h-20 object-contain border border-gray-200 rounded"
									/>
								</div>
							)}

							{error && (
								<div className="bg-red-50 border border-red-200 rounded-lg p-3">
									<p className="text-sm text-red-600">{error}</p>
								</div>
							)}
						</div>
					</div>

					<div className="space-y-3">
						<button
							onClick={signContract}
							disabled={!signatureFile || signing}
							className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
						>
							{signing ? (
								<>
									<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
									Signing...
								</>
							) : (
								<>
									<CheckCircle className="h-4 w-4" />
									Sign Contract
								</>
							)}
						</button>

						<button
							onClick={() => router.back()}
							className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300"
						>
							Cancel
						</button>
					</div>

					<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
						<h4 className="text-sm font-medium text-blue-900 mb-2">Legal Notice</h4>
						<p className="text-xs text-blue-700">
							By signing this contract, you acknowledge that you have read and agree to all terms and conditions. 
							This electronic signature has the same legal effect as a handwritten signature.
						</p>
					</div>
				</main>

				<BottomNavbar userRole="vendor" />
			</div>
		</ProtectedRoute>
	)
}

export default function VendorContractSignPage() {
  return (
    <Suspense fallback={<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden"><div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div></div>}>
      <VendorContractSignPageInner />
    </Suspense>
  )
}


