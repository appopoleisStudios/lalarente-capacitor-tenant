'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import BottomNavbar from '@/components/BottomNavbar'
import { ArrowLeft } from 'lucide-react'

type ServiceContract = {
	id: string
	title: string
	status: string
	property_id: string
	owner_id: string
	vendor_id: string
	tenant_id: string | null
	pdf_url: string | null
	pdf_sha256: string | null
}

type TenancyContract = {
	id: string
	title: string
	status: string
	property_id: string
	owner_id: string
	tenant_id: string
	lease_id: string | null
	pdf_url: string | null
	pdf_sha256: string | null
}

function ContractDetailPageInner() {
	const params = useSearchParams()
	const router = useRouter()
	const contractId = params.get('id') || ''
	const [serviceContract, setServiceContract] = useState<ServiceContract | null>(null)
	const [tenancyContract, setTenancyContract] = useState<TenancyContract | null>(null)
	const [loading, setLoading] = useState(false)
	const [msg, setMsg] = useState('')
	const { profile } = useAuthStore()

	// Ancillary display data
	const [ownerName, setOwnerName] = useState('')
	const [tenantName, setTenantName] = useState('')
	const [vendorName, setVendorName] = useState('')
	const [ownerEmail, setOwnerEmail] = useState('')
	const [tenantEmail, setTenantEmail] = useState('')
	const [vendorEmail, setVendorEmail] = useState('')
	const [propertyLine, setPropertyLine] = useState('')
	const [statusPill, setStatusPill] = useState<'pending_signatures' | 'active' | 'completed' | string>('pending_signatures')
	const [sigs, setSigs] = useState<{ signer_role: string; signed_at: string }[]>([])
	const [audit, setAudit] = useState<{ action: string; timestamp: string; actor_role: string | null }[]>([])
	// Service pricing & MMS (service contracts)
	const [svcQuote, setSvcQuote] = useState<{ id?: string; subtotal: number | null; total: number | null; status: string | null } | null>(null)
	const [svcPO, setSvcPO] = useState<{ id?: string; po_number?: string | null; status?: string | null; subtotal?: number | null; vat_amount?: number | null; platform_fee_amount?: number | null; total_amount?: number | null } | null>(null)
	const [svcExec, setSvcExec] = useState<{ status: string | null } | null>(null)
	// Financial summary (tenant)
	const [financial, setFinancial] = useState<{ rentAmount?: number; depositAmount?: number; leaseStart?: string; leaseEnd?: string } | null>(null)
	// Request changes UI
	const [showChanges, setShowChanges] = useState(false)
	const [changesText, setChangesText] = useState('')

	// Signature UI (tabs like draw/type/upload; MVP: upload + basic draw placeholder)
	const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'upload'>('draw')
	const [consent, setConsent] = useState(false)
  const [typedSig, setTypedSig] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
	const [typedStyle, setTypedStyle] = useState<'left' | 'right' | null>(null)
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const [hasStroke, setHasStroke] = useState(false)
	const isDrawingRef = useRef(false)
	const lastPointRef = useRef<{ x: number; y: number } | null>(null)

	function setupCanvasDimensions(c: HTMLCanvasElement) {
		const rect = c.getBoundingClientRect()
		const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
		if (c.width !== Math.floor(rect.width * dpr) || c.height !== Math.floor(rect.height * dpr)) {
			c.width = Math.floor(rect.width * dpr)
			c.height = Math.floor(rect.height * dpr)
			const ctx = c.getContext('2d')
			if (ctx) {
				ctx.scale(dpr, dpr)
				ctx.lineCap = 'round'
				ctx.lineJoin = 'round'
				ctx.strokeStyle = '#000'
				ctx.lineWidth = 2
			}
		}
	}

	function getPointFromEvent(e: React.MouseEvent | React.TouchEvent, c: HTMLCanvasElement): { x: number; y: number } {
		// Do not call preventDefault here to avoid passive listener warning
		const rect = c.getBoundingClientRect()
		const isTouch = 'touches' in (e as any)
		const clientX = isTouch ? ((e as any).touches?.[0]?.clientX || 0) : (e as React.MouseEvent).clientX
		const clientY = isTouch ? ((e as any).touches?.[0]?.clientY || 0) : (e as React.MouseEvent).clientY
		return { x: clientX - rect.left, y: clientY - rect.top }
	}

	useEffect(() => {
		if (!contractId) return
		const load = async () => {
			setLoading(true)
			setMsg('')
			try {
				const { data: svc } = await supabase.from('service_contracts').select('*').eq('id', contractId).maybeSingle()
				if (svc) {
					setServiceContract(svc as unknown as ServiceContract)
					setTenancyContract(null)
					setStatusPill((svc as ServiceContract).status || 'pending_signatures')
					await loadAncillary('service', svc)
				} else {
					const { data: tnc } = await supabase.from('tenancy_contracts').select('*').eq('id', contractId).maybeSingle()
					if (tnc) {
						setTenancyContract(tnc as unknown as TenancyContract)
						setServiceContract(null)
						setStatusPill((tnc as TenancyContract).status || 'pending_signatures')
						await loadAncillary('tenancy', tnc)
					}
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Failed to load contract'
				setMsg(message)
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [contractId])

	const contract = serviceContract || tenancyContract
const role = profile?.role
	const isService = !!serviceContract
	const currentParty = getCurrentPartyRole()

	async function loadAncillary(kind: 'service' | 'tenancy', row: ServiceContract | TenancyContract) {
		try {
			// Parties (fetch directly from profiles table)
			const resolveProfile = async (userId: string | null | undefined) => {
				if (!userId) return null
				const res = await supabase.from('profiles').select('full_name, email').eq('id', userId).maybeSingle()
				return res.data || null
			}

			const owner = await resolveProfile(row.owner_id)
			if (owner) {
				setOwnerName(owner.full_name || 'Owner')
				setOwnerEmail(owner.email || '')
			} else {
				setOwnerName('Owner')
				setOwnerEmail('')
			}

			if ('tenant_id' in row && row.tenant_id) {
				const tenant = await resolveProfile(row.tenant_id)
				if (tenant) {
					setTenantName(tenant.full_name || 'Tenant')
					setTenantEmail(tenant.email || '')
				} else {
					setTenantName('Tenant')
					setTenantEmail('')
				}
			} else {
				setTenantName('')
				setTenantEmail('')
			}

			if ('vendor_id' in row && (row as ServiceContract).vendor_id) {
				const vendor = await resolveProfile((row as ServiceContract).vendor_id)
				if (vendor) {
					setVendorName(vendor.full_name || 'Vendor')
					setVendorEmail(vendor.email || '')
				} else {
					setVendorName('Vendor')
					setVendorEmail('')
				}
			} else {
				setVendorName('')
				setVendorEmail('')
			}
			// Property
			const prop = await supabase.from('properties').select('address,city').eq('id', row.property_id).maybeSingle()
			const addr = prop.data ? [prop.data.address, prop.data.city].filter(Boolean).join(', ') : String(row.property_id)
			setPropertyLine(addr)

			// Financial Summary (tenancy only)
			if (kind === 'tenancy') {
				// Removed unused variables: leaseMonthly, leaseDeposit, leaseDueDay, leaseTerm
				try {
					const tnc = row as TenancyContract
					let leaseRes
					if (tnc.lease_id) {
						leaseRes = await (supabase as any).from('leases').select('rent_amount,deposit_amount,lease_start,lease_end').eq('id', tnc.lease_id).maybeSingle()
					} else {
						leaseRes = await (supabase as any)
							.from('leases')
							.select('rent_amount,deposit_amount,lease_start,lease_end')
							.eq('tenant_id', tnc.tenant_id)
							.eq('property_id', tnc.property_id)
							.order('created_at', { ascending: false })
							.limit(1)
					}
                    const lease = (leaseRes.data as unknown as { rent_amount?: number | null; deposit_amount?: number | null; lease_start?: string | null; lease_end?: string | null } | null) || null
                    if (lease) {
                        const next: { rentAmount?: number; depositAmount?: number; leaseStart?: string; leaseEnd?: string } = {}
                        if (typeof lease.rent_amount === 'number') { next.rentAmount = lease.rent_amount }
                        if (typeof lease.deposit_amount === 'number') { next.depositAmount = lease.deposit_amount }
                        if (lease.lease_start) { next.leaseStart = lease.lease_start }
                        if (lease.lease_end) { next.leaseEnd = lease.lease_end }
                        setFinancial(next)
                    } else {
                        setFinancial(null)
                    }
                } catch {
                    setFinancial(null)
                }
			} else if (kind === 'service') {
				// Service pricing & MMS cards: latest Quote, PO, Execution
				try {
					const [qRes, poRes, exRes] = await Promise.all([
						(supabase as any)
							.from('quotes')
							.select('id,status,subtotal,total_amount,created_at')
							.eq('contract_id', (row as ServiceContract).id)
							.order('created_at', { ascending: false })
							.limit(1),
						(supabase as any)
							.from('purchase_orders')
							.select('id,po_number,status,subtotal,vat_amount,platform_fee_amount,total_amount,created_at')
							.eq('contract_id', (row as ServiceContract).id)
							.order('created_at', { ascending: false })
							.limit(1),
						(supabase as any)
							.from('job_executions')
							.select('id,status,created_at')
							.eq('contract_id', (row as ServiceContract).id)
							.order('created_at', { ascending: false })
							.limit(1),
					])
					const q = Array.isArray(qRes?.data) ? qRes.data[0] : null
					setSvcQuote(q ? { id: q.id, subtotal: q.subtotal ?? null, total: q.total_amount ?? null, status: q.status ?? null } : null)
					const po = Array.isArray(poRes?.data) ? poRes.data[0] : null
					setSvcPO(po ? { id: po.id, po_number: po.po_number ?? null, status: po.status ?? null, subtotal: po.subtotal ?? null, vat_amount: po.vat_amount ?? null, platform_fee_amount: po.platform_fee_amount ?? null, total_amount: po.total_amount ?? null } : null)
					const ex = Array.isArray(exRes?.data) ? exRes.data[0] : null
					setSvcExec(ex ? { status: ex.status ?? null } : null)
				} catch {
					setSvcQuote(null); setSvcPO(null); setSvcExec(null)
				}
			}
			// Signatures list
			const sigTable = kind === 'service' ? 'service_contract_signatures' : 'tenancy_contract_signatures'
			const sigRes = await supabase.from(sigTable).select('signer_role,signed_at').eq('contract_id', row.id).order('signed_at', { ascending: true })
            setSigs(sigRes.data || [])

            // UX fix: Override status pill to 'pending_signatures' until required parties have signed
            try {
                const sigList = (sigRes.data || []) as { signer_role: string; signed_at: string }[]
                const ownerHas = sigList.some(s => s.signer_role === 'owner')
                const vendorHas = sigList.some(s => s.signer_role === 'vendor')
                const tenantHas = sigList.some(s => s.signer_role === 'tenant')
                const currentStatus = (kind === 'service' ? (row as ServiceContract).status : (row as TenancyContract).status) || 'pending_signatures'

                const signaturesComplete = kind === 'service' ? (ownerHas && vendorHas) : (ownerHas && tenantHas)

                // Only coerce to pending_signatures when not completed and signatures are incomplete
                if (currentStatus !== 'completed' && !signaturesComplete) {
                    setStatusPill('pending_signatures')
                } else {
                    setStatusPill(currentStatus)
                }
            } catch {
                // best-effort; keep existing statusPill if anything goes wrong
            }

			// Log 'viewed' activity for current viewer, then load recent activity
			// Only log a 'viewed' event if it hasn't been logged very recently by this user
			try {
				const recent = await supabase
					.from(kind === 'service' ? 'service_contract_audit_logs' : 'tenancy_contract_audit_logs')
					.select('id, created_at')
					.eq('contract_id', row.id)
					.order('created_at', { ascending: false })
					.limit(1)
				if (!recent.error) {
					const last = (recent.data || [])[0]
					const now = Date.now()
					const lastMs = last?.created_at ? new Date(last.created_at).getTime() : 0
					const within5s = lastMs > 0 && (now - lastMs) < 5000
					if (!within5s) {
						if (kind === 'service') {
							await (supabase as any).rpc('log_service_contract_event', { p_contract_id: row.id, p_event: 'viewed', p_data: {} })
						} else {
							await (supabase as any).rpc('log_tenancy_contract_event', { p_contract_id: row.id, p_event: 'viewed', p_data: {} })
						}
					}
				}
			} catch {}

			// Audit log (Recent Activity)
			const auditTable = kind === 'service' ? 'service_contract_audit_logs' : 'tenancy_contract_audit_logs'
			const auditRes = await supabase
				.from(auditTable as never)
				.select('event, created_at, actor_id')
				.eq('contract_id', row.id)
				.order('created_at', { ascending: false })
				.limit(20)
			const rows = (auditRes.data || []) as { event: string; created_at: string | null; actor_id: string | null }[]
			const mapped = rows.map(r => {
				const evt = r.event || 'event'
				let actorRole: 'owner' | 'tenant' | 'vendor' | null = null
				if (r.actor_id) {
					if (r.actor_id === (row as any).owner_id) actorRole = 'owner'
					else if ('tenant_id' in row && r.actor_id === (row as any).tenant_id) actorRole = 'tenant'
					else if ('vendor_id' in (row as any) && r.actor_id === (row as any).vendor_id) actorRole = 'vendor'
				}
				return { action: evt, timestamp: r.created_at || new Date().toISOString(), actor_role: actorRole }
			})
			setAudit(mapped)
		} catch {
			// ignore ancillary errors
		}
	}

	function hasSigned(roleName: string | undefined): boolean {
		if (!roleName) return false
		return sigs.some(s => s.signer_role === roleName)
	}

	function getCurrentPartyRole(): 'owner' | 'tenant' | 'vendor' | null {
		if (!contract || !profile?.id) return null
		if (isService) {
			const svc = contract as ServiceContract
			if (svc.owner_id === profile.id) return 'owner'
			if ((svc as ServiceContract).vendor_id === profile.id) return 'vendor'
			if ((svc as ServiceContract).tenant_id && (svc as ServiceContract).tenant_id === profile.id) return 'tenant'
			return null
		} else {
			const tnc = contract as TenancyContract
			if (tnc.owner_id === profile.id) return 'owner'
			if (tnc.tenant_id === profile.id) return 'tenant'
			return null
		}
	}

  function canSignInline(): boolean {
		if (statusPill !== 'pending_signatures') return false
		const party = getCurrentPartyRole()
		if (!party) return false
    return consent && (
      activeTab === 'upload'
        ? !!uploadFile
        : activeTab === 'type'
          ? typedSig.trim().length > 0 && typedStyle !== null
          : hasStroke
    )
	}

	function startDraw(e: React.MouseEvent | React.TouchEvent) {
		const c = canvasRef.current
		if (!c) return
		setupCanvasDimensions(c)
		const ctx = c.getContext('2d')
		if (!ctx) return
		const p = getPointFromEvent(e, c)
		ctx.beginPath()
		ctx.moveTo(p.x, p.y)
		isDrawingRef.current = true
		lastPointRef.current = p
	}
	function draw(e: React.MouseEvent | React.TouchEvent) {
		if (!isDrawingRef.current) return
		const c = canvasRef.current
		if (!c) return
		const ctx = c.getContext('2d')
		if (!ctx) return
		const p = getPointFromEvent(e, c)
		const last = lastPointRef.current
		if (last) {
			ctx.lineTo(p.x, p.y)
			ctx.stroke()
			lastPointRef.current = p
			setHasStroke(true)
		}
	}
	function endDraw() {
		isDrawingRef.current = false
		lastPointRef.current = null
	}
	function clearCanvas() {
		const c = canvasRef.current
		if (!c) return
		const ctx = c.getContext('2d')
		if (!ctx) return
		ctx.clearRect(0, 0, c.width, c.height)
		setHasStroke(false)
	}

	async function handleSign() {
		try {
			if (!contract) return
			const party = getCurrentPartyRole()
			if (!party) {
				setMsg('You are not a party to this contract.')
				return
			}
			let signatureUrl: string | null = null
			if (uploadFile) {
				const path = `signatures/${contractId}/${profile?.id || 'user'}-${Date.now()}-${uploadFile.name}`
				const up = await supabase.storage.from('contracts').upload(path, uploadFile, { upsert: true })
				if (up.error) throw up.error
				signatureUrl = up.data?.path || path
			}
			const table = isService ? 'service_contract_signatures' : 'tenancy_contract_signatures'
			const roleName = party
			const ins = await supabase.from(table).insert({
				contract_id: contractId,
				signer_role: roleName,
				signer_id: profile?.id || '',
				signature_image_url: signatureUrl || 'uploaded-in-external-system',
				signed_at: new Date().toISOString(),
			})
			if (ins.error) throw ins.error
			// Log audit event
			const eventName = roleName === 'owner' ? 'signed_by_owner' : roleName === 'tenant' ? 'signed_by_tenant' : 'signed_by_vendor'
			if (isService) {
				await (supabase as any).rpc('log_service_contract_event', { p_contract_id: contractId, p_event: eventName, p_data: {} })
			} else {
				await (supabase as any).rpc('log_tenancy_contract_event', { p_contract_id: contractId, p_event: eventName, p_data: {} })
			}
			await loadAncillary(isService ? 'service' : 'tenancy', contract as ServiceContract | TenancyContract)
			setMsg('Signed successfully')
		} catch (e) {
			setMsg(e instanceof Error ? e.message : 'Failed to sign')
		}
	}

	return (
		<div className={"mobile-app w-[100vw] max-w-[100vw] mx-0 min-h-screen pb-24 overflow-x-hidden bg-white"}>
			{/* Header */}
			<div className={`px-4 py-4 ${role === 'owner' ? 'bg-gradient-to-r from-blue-700 to-blue-600' : role === 'tenant' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500' : 'bg-gradient-to-r from-indigo-600 to-indigo-500'}`}>
				<div className="max-w-3xl mx-auto text-white">
					<div className="flex items-center gap-3">
						<button 
							onClick={() => router.back()} 
							className="p-2 hover:bg-white/10 rounded-lg transition-colors"
						>
							<ArrowLeft className="h-5 w-5 text-white" />
						</button>
						<div className="flex-1">
							<div className="text-xl font-bold">Contract Details</div>
							<div className="mt-1 text-xs opacity-90">
								<span className="bg-white/20 px-2 py-0.5 rounded-full">{role || 'Viewer'}</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Body */}
			<div className="max-w-sm mx-auto p-4 space-y-4">
				{loading && <div>Loading...</div>}
				{msg && <div className="p-3 rounded border border-gray-200 bg-gray-50 text-gray-700">{msg}</div>}
				{!contractId && <div className="text-gray-600">No contract selected. Append ?id=&lt;uuid&gt; to the URL.</div>}
				{contract && (
					<>
						{(() => {
							const createdAt = (contract as any).created_at || ''
							const updatedAt = (contract as any).updated_at || ''
							const shortId = contractId.length > 5 ? `...${contractId.slice(-5)}` : contractId
                        return (
                            <AgreementCard
									title={contract.title}
									propertyLine={propertyLine || (contract as any).property_id}
									createdAt={createdAt}
									updatedAt={updatedAt}
                                shortId={shortId}
                                status={statusPill}
								/>
							)
						})()}
						<PartiesCard ownerName={ownerName} tenantName={tenantName} vendorName={vendorName} ownerEmail={ownerEmail} tenantEmail={tenantEmail} vendorEmail={vendorEmail} />
                        {financial && (
                            <FinancialSummaryCard 
                                {...(financial.rentAmount !== undefined ? { rentAmount: financial.rentAmount } : {})}
                                {...(financial.depositAmount !== undefined ? { depositAmount: financial.depositAmount } : {})}
                                {...(financial.leaseStart ? { leaseStart: financial.leaseStart } : {})}
                                {...(financial.leaseEnd ? { leaseEnd: financial.leaseEnd } : {})}
                            />
                        )}
						{isService && (
							<ServicePriceBreakdownCard quote={svcQuote} po={svcPO} />
						)}
		{isService && role === 'owner' && (
			<OwnerActionsCard
				quote={svcQuote}
				po={svcPO}
				exec={svcExec}
				contractId={contractId}
				canApproveQuote={hasSigned('owner') && hasSigned('vendor')}
				onScrollToMessages={() => {
					const el = document.getElementById('contract-messages')
					if (el) el.scrollIntoView({ behavior: 'smooth' })
				}}
			/>
		)}
						{isService && (
							<POExecutionStatusCard po={svcPO} exec={svcExec} />
						)}
						<ProgressCard status={statusPill} sigs={sigs} isService={isService} />
						{statusPill === 'pending_signatures' && !hasSigned(currentParty || undefined) && (
            <SignatureRequiredCard
								activeTab={activeTab}
								setActiveTab={setActiveTab}
								typedSig={typedSig}
								setTypedSig={setTypedSig}
								typedStyle={typedStyle}
								setTypedStyle={setTypedStyle}
                                
								consent={consent}
								setConsent={setConsent}
								canvasRef={canvasRef}
								startDraw={startDraw}
								draw={draw}
								endDraw={endDraw}
								clearCanvas={clearCanvas}
								canSign={canSignInline()}
                onSign={handleSign}
                {...(role ? { role } : {})}
                uploadFile={uploadFile}
                setUploadFile={setUploadFile}
                onRequestChanges={() => setShowChanges(true)}
							/>
						)}
					{/* Messaging Section */}
					<div id="contract-messages">
						<ContractMessagesCard 
							contractId={contractId} 
							propertyId={(contract as any).property_id} 
							role={role ?? null}
							vendorName={vendorName}
							ownerName={ownerName}
							tenantName={tenantName}
							isService={isService}
							vendorId={(contract as any)?.vendor_id}
							ownerId={(contract as any)?.owner_id}
						/>
					</div>
						
						{showChanges && (
							<div className="bg-white rounded-xl border p-4">
								<div className="text-lg font-semibold text-gray-900 mb-3">Request Changes</div>
								<textarea value={changesText} onChange={(e)=> setChangesText(e.target.value)} rows={3} className="w-full p-3 border border-gray-300 rounded-lg" placeholder="Describe the changes you'd like to request..." />
								<div className="flex gap-3 mt-3">
									<button onClick={async()=>{
										try{
											if(!contractId||!changesText.trim()) return
											if(isService){ await (supabase as any).rpc('log_service_contract_event',{ p_contract_id: contractId, p_event:'requested_changes', p_data:{ note: changesText }}) }
											else { await (supabase as any).rpc('log_tenancy_contract_event',{ p_contract_id: contractId, p_event:'requested_changes', p_data:{ note: changesText }}) }
											setShowChanges(false); setChangesText('')
											if(contract) await loadAncillary(isService?'service':'tenancy', contract as any)
											setMsg('Change request sent')
										}catch(e){ setMsg(e instanceof Error? e.message : 'Failed to send change request') }
									}} className={`px-4 py-2 rounded-lg text-white ${role==='owner' ? 'bg-blue-600 hover:bg-blue-700' : role==='tenant' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>Send Request</button>
									<button onClick={()=>{ setShowChanges(false); setChangesText('') }} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
								</div>
							</div>
						)}
						<DocumentCard contract={contract} status={statusPill} />
					<ActivityCard items={audit} role={role || null} />
                    <FooterCard
						canSign={statusPill === 'pending_signatures' && !hasSigned(currentParty || undefined) ? canSignInline() : false}
						onSign={handleSign}
                        {...(role ? { role } : {})}
					/>
					</>
				)}
			</div>
			
			{/* Bottom Navigation */}
			<BottomNavbar userRole={role as 'owner' | 'vendor' | 'tenant' | 'admin'} />
		</div>
	)
}

export default function ContractDetailPage() {
	return (
		<Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading…</div>}>
			<ContractDetailPageInner />
		</Suspense>
	)
}

// removed duplicate function block

// Removed unused Signatures function

function FinancialSummaryCard({ rentAmount, depositAmount, leaseStart, leaseEnd }: { rentAmount?: number; depositAmount?: number; leaseStart?: string; leaseEnd?: string }) {
  const hasAny = typeof rentAmount === 'number' || typeof depositAmount === 'number' || (leaseStart && leaseEnd)
  if (!hasAny) return null
  const currency = (n?: number) => (typeof n === 'number' ? `R ${n.toLocaleString()}` : '')
  const termReadable = leaseStart && leaseEnd ? `${new Date(leaseStart).toLocaleString(undefined,{month:'short',year:'numeric'})} - ${new Date(leaseEnd).toLocaleString(undefined,{month:'short',year:'numeric'})}` : ''
  const months = leaseStart && leaseEnd ? Math.max(1, Math.round((new Date(leaseEnd).getTime() - new Date(leaseStart).getTime())/(1000*60*60*24*30))) : null
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="text-lg font-semibold text-gray-900 mb-3">Financial Summary</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Monthly Rent</div>
          <div className="text-xl font-bold text-gray-900">{currency(rentAmount)}</div>
          <div className="text-xs text-gray-500 mt-1">Due 1st of each month</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Security Deposit</div>
          <div className="text-xl font-bold text-gray-900">{currency(depositAmount)}</div>
          <div className="flex items-center gap-1 mt-1 text-xs text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Outstanding</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Lease Term</div>
          <div className="text-xl font-bold text-gray-900">{months ? `${months} months` : ''}</div>
          <div className="text-xs text-gray-500 mt-1">{termReadable}</div>
        </div>
      </div>
    </div>
  )
}

function ServicePriceBreakdownCard({ quote, po }: { quote: { subtotal: number | null; total: number | null; status: string | null } | null; po: { po_number?: string | null; status?: string | null; subtotal?: number | null; vat_amount?: number | null; platform_fee_amount?: number | null; total_amount?: number | null } | null }) {
  const currency = (n?: number | null) => (typeof n === 'number' ? `R ${Number(n).toLocaleString()}` : '-')
  const isVatShown = typeof (po?.vat_amount ?? null) === 'number' && Number(po?.vat_amount) > 0
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="text-lg font-semibold text-gray-900 mb-3">Price Breakdown</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Latest Quote</div>
          <div className="text-xs text-gray-500 mb-1">Status: {quote?.status || '—'}</div>
          <div className="flex items-center justify-between text-sm text-gray-700"><span>Subtotal</span><span>{currency(quote?.subtotal)}</span></div>
          <div className="flex items-center justify-between text-sm text-gray-700"><span>Total</span><span className="font-semibold text-gray-900">{currency(quote?.total)}</span></div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Purchase Order</div>
          <div className="text-xs text-gray-500 mb-1">{po?.po_number ? `PO ${po.po_number}` : 'Not issued yet'}</div>
          <div className="flex items-center justify-between text-sm text-gray-700"><span>Subtotal</span><span>{currency(po?.subtotal)}</span></div>
          {isVatShown && (
            <div className="flex items-center justify-between text-sm text-gray-700"><span>VAT</span><span>{currency(po?.vat_amount || 0)}</span></div>
          )}
          <div className="flex items-center justify-between text-sm text-gray-700"><span>Platform Fee</span><span>{currency(po?.platform_fee_amount || 0)}</span></div>
          <div className="flex items-center justify-between text-sm text-gray-700"><span>Total</span><span className="font-semibold text-gray-900">{currency(po?.total_amount)}</span></div>
        </div>
      </div>
      {!isVatShown && (
        <div className="text-xs text-gray-500 mt-2">Vendor not VAT‑registered; VAT line hidden.</div>
      )}
    </div>
  )
}

function POExecutionStatusCard({ po, exec }: { po: { status?: string | null } | null; exec: { status: string | null } | null }) {
  const statusChip = (label: string, c: string) => (<span className={`px-2 py-1 rounded-full text-xs font-medium ${c}`}>{label}</span>)
  const poStatus = po?.status || 'none'
  const execStatus = exec?.status || 'not_started'
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="text-lg font-semibold text-gray-900 mb-3">Job Status</div>
      <div className="flex items-center gap-2 text-xs">
        {poStatus === 'po_issued' ? statusChip('PO Issued', 'bg-indigo-100 text-indigo-800') : statusChip('PO Not Issued', 'bg-gray-100 text-gray-600')}
        {execStatus === 'in_progress' && statusChip('In Progress', 'bg-emerald-100 text-emerald-800')}
        {execStatus === 'completed' && statusChip('Completed', 'bg-slate-100 text-slate-700')}
      </div>
    </div>
  )
}

function OwnerActionsCard({
	quote,
	po,
	exec,
	contractId,
	canApproveQuote,
	onScrollToMessages
}: {
	quote: { id?: string; subtotal: number | null; total: number | null; status: string | null } | null
	po: { id?: string; po_number?: string | null; status?: string | null; subtotal?: number | null; vat_amount?: number | null; platform_fee_amount?: number | null; total_amount?: number | null } | null
	exec: { status: string | null } | null
	contractId: string
	canApproveQuote: boolean
	onScrollToMessages: () => void
}) {
	const hasQuote = !!quote
	const hasPO = !!po
	const execStatus = exec?.status || 'not_started'

	const Button = ({
		label,
		onClick,
		variant = 'primary',
		disabled = false
	}: { label: string; onClick?: () => void; variant?: 'primary' | 'secondary'; disabled?: boolean }) => (
		<button
			onClick={disabled ? undefined : onClick}
			className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
				variant === 'primary'
					? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600'
					: 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
			} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
			aria-disabled={disabled}
		>
			{label}
		</button>
	)

	return (
		<div className="bg-white rounded-xl border p-4">
			<div className="text-lg font-semibold text-gray-900 mb-3">Owner Actions</div>
			<div className="grid grid-cols-2 gap-3">
				{/* Quotes */}
					<Button
						label="Review Quotes"
						variant="secondary"
						disabled={!hasQuote}
						onClick={() => { window.location.href = '/dashboard/owner/quotes' }}
					/>
					<Button
						label="Compare Quotes"
						variant="secondary"
						disabled={!hasQuote}
						onClick={() => { window.location.href = '/dashboard/owner/quotes/compare' }}
					/>

				{/* PO */}
				<Button
					label="Approve Quote → Issue PO"
					disabled={!hasQuote || hasPO || !canApproveQuote}
					onClick={async () => {
						if (!quote?.id) return
						
						try {
							// Call the RPC function to approve quote and generate PO
							const { data, error } = await supabase.rpc('approve_quote_and_generate_po', {
								quote_id: quote.id
							})
							
							if (error) {
								throw error
							}
							
							// Show success message and reload page to reflect changes
							alert(`Quote approved! Purchase Order ${data} has been generated.`)
							window.location.reload()
							
						} catch (e) {
							alert(`Failed to approve quote: ${e instanceof Error ? e.message : 'Unknown error'}`)
						}
					}}
				/>
				<Button
					label="View PO"
					variant="secondary"
					disabled={!hasPO}
					onClick={() => {
						if (po?.id) {
							window.location.href = `/dashboard/owner/purchase-orders/${po.id}`
						}
					}}
				/>

				{/* Execution & Comms */}
				<Button
					label={execStatus === 'in_progress' ? 'Track Execution' : execStatus === 'completed' ? 'Execution Completed' : 'Start Execution'}
					variant="secondary"
					disabled={!hasPO}
					onClick={() => {
						window.scrollTo({ top: 0, behavior: 'smooth' })
					}}
				/>
				<Button
					label="Message Vendor"
					variant="secondary"
					onClick={onScrollToMessages}
				/>
				<Button
					label="Review Closure"
					variant="secondary"
					disabled={execStatus !== 'completed'}
					onClick={() => {
						if (contractId) {
							window.location.href = `/dashboard/owner/closure/${contractId}`
						}
					}}
				/>
			</div>
			<div className="mt-2 text-xs text-gray-500">
				Quotes/PO pages are being wired next; buttons are enabled only when data exists.
			</div>
		</div>
	)
}

// Removed unused InlineSign function

// Modular Cards
function AgreementCard({ title, propertyLine, createdAt, updatedAt, shortId, status }: { title: string; propertyLine: string; createdAt?: string; updatedAt?: string; shortId?: string; status?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold text-gray-900">{title}</div>
          <div className="text-sm text-gray-600 mt-1">{propertyLine}</div>
        </div>
        {status && (
          <div className={`px-3 py-1 rounded-full text-sm ${status === 'active' ? 'bg-emerald-100 text-emerald-700' : status === 'completed' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>
            {status === 'pending_signatures' ? 'Pending Signatures' : status === 'active' ? 'Active' : 'Completed'}
          </div>
        )}
      </div>
      {(createdAt || updatedAt || shortId) && (
        <div className="flex items-center gap-6 text-xs text-gray-500 mt-3">
          {createdAt && <span>Created: {String(createdAt).slice(0,10)}</span>}
          {updatedAt && <span>Updated: {String(updatedAt).slice(0,10)}</span>}
          {shortId && <span>ID: {shortId}</span>}
        </div>
      )}
    </div>
  )
}

function PartiesCard({ ownerName, tenantName, vendorName, ownerEmail, tenantEmail, vendorEmail }: { ownerName: string; tenantName: string; vendorName: string; ownerEmail?: string; tenantEmail?: string; vendorEmail?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="text-lg font-semibold text-gray-900 mb-3">Contract Parties</div>
      <div className="space-y-3">
        {ownerName && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center">{ownerName.slice(0,2).toUpperCase()}</div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">{ownerName}</div>
              <div className="text-xs text-blue-700 bg-blue-50 w-max px-2 py-0.5 rounded">Owner</div>
              {ownerEmail && <div className="text-xs text-gray-500">{ownerEmail}</div>}
            </div>
          </div>
        )}
        {tenantName && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center">{tenantName.slice(0,2).toUpperCase()}</div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">{tenantName}</div>
              <div className="text-xs text-emerald-700 bg-emerald-50 w-max px-2 py-0.5 rounded">Tenant</div>
              {tenantEmail && <div className="text-xs text-gray-500">{tenantEmail}</div>}
            </div>
          </div>
        )}
        {vendorName && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center">{vendorName.slice(0,2).toUpperCase()}</div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">{vendorName}</div>
              <div className="text-xs text-indigo-700 bg-indigo-50 w-max px-2 py-0.5 rounded">Vendor</div>
              {vendorEmail && <div className="text-xs text-gray-500">{vendorEmail}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ProgressCard({ status, sigs, isService }: { status: string; sigs: { signer_role: string; signed_at: string }[]; isService?: boolean }) {
  const ownerSig = sigs.find(s => s.signer_role === 'owner')
  const tenantSig = sigs.find(s => s.signer_role === 'tenant')
  const vendorSig = sigs.find(s => s.signer_role === 'vendor')

  type StepState = 'done' | 'current' | 'pending'
  const stateFor = (hasSigned: boolean, isCurrent: boolean): StepState => hasSigned ? 'done' : (isCurrent ? 'current' : 'pending')

  const tenantSigned = !!tenantSig
  const ownerSigned = !!ownerSig
  // Current logic:
  // - Tenant is current when tenant hasn't signed (covers neither-signed and owner-first cases)
  // - Owner is current only when tenant has signed but owner hasn't
  const signedByTenantState: StepState = stateFor(tenantSigned, !tenantSigned)
  const signedByOwnerState: StepState = stateFor(ownerSigned, tenantSigned && !ownerSigned)
  const activeState: StepState = (status === 'active' || status === 'completed') ? 'done' : 'pending'

  const stepOwner: { key: string; label: string; sub?: string; state: StepState; when?: string } = { 
    key: 'signed_owner', 
    label: 'Signed by Owner', 
    ...(signedByOwnerState === 'current' ? { sub: 'Waiting for signature' } : signedByOwnerState === 'pending' ? { sub: 'Pending' } : {}), 
    state: signedByOwnerState, 
    ...(ownerSig?.signed_at ? { when: ownerSig.signed_at } : {}),
  }
  const stepTenant: { key: string; label: string; sub?: string; state: StepState; when?: string } = { 
    key: 'signed_tenant', 
    label: 'Signed by Tenant', 
    ...(signedByTenantState === 'current' ? { sub: 'Waiting for signature' } : signedByTenantState === 'pending' ? { sub: 'Pending' } : {}), 
    state: signedByTenantState, 
    ...(tenantSig?.signed_at ? { when: tenantSig.signed_at } : {}),
  }
  const thirdIsOwner = ownerSigned && !tenantSigned
  let steps: { key: string; label: string; sub?: string; state: StepState; when?: string }[] = []
  if (isService) {
    const stepVendor: { key: string; label: string; sub?: string; state: StepState; when?: string } = {
      key: 'signed_vendor',
      label: 'Signed by Vendor',
      ...(!vendorSig ? { sub: 'Waiting for signature' } : {}),
      state: vendorSig ? 'done' : 'pending',
      ...(vendorSig?.signed_at ? { when: vendorSig.signed_at } : {}),
    }
    // Service contracts: Created → Sent → Signed by Owner → Signed by Vendor → Active (or vendor first)
    const vendorFirst = !!vendorSig && !ownerSig
    steps = [
      { key: 'created', label: 'Created', state: 'done' },
      { key: 'sent', label: 'Sent', state: 'done' },
      vendorFirst ? stepVendor : stepOwner,
      vendorFirst ? stepOwner : stepVendor,
      { key: 'active', label: 'Active', ...(activeState === 'pending' ? { sub: 'Pending' } : {}), state: activeState },
    ]
  } else {
    steps = [
      { key: 'created', label: 'Created', state: 'done' },
      { key: 'sent', label: 'Sent', state: 'done' },
      thirdIsOwner ? stepOwner : stepTenant,
      thirdIsOwner ? stepTenant : stepOwner,
      { key: 'active', label: 'Active', ...(activeState === 'pending' ? { sub: 'Pending' } : {}), state: activeState },
    ]
  }

  const StepIcon = ({ state }: { state: StepState }) => {
    if (state === 'done') {
      return <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">✓</div>
    }
    if (state === 'current') {
      return <div className="w-6 h-6 rounded-full bg-amber-500/90 text-white flex items-center justify-center">
        <span className="w-2 h-2 bg-white rounded-full" />
      </div>
    }
    return <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
      <span className="w-2 h-2 bg-gray-400 rounded-full" />
    </div>
  }

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="text-lg font-semibold text-gray-900 mb-4">Contract Progress</div>
      <div className="relative">
        <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
        <div className="space-y-6">
          {steps.map((st, idx) => (
            <div key={st.key} className="relative pl-8">
              {/* connector coloring above/below for done steps */}
              {idx > 0 && <div className={`absolute left-3 -top-3 w-px h-3 ${st.state === 'done' ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
              {idx < steps.length - 1 && <div className={`absolute left-3 top-6 w-px h-6 ${st.state === 'done' ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
              <div className="absolute left-0 top-0">
                <StepIcon state={st.state} />
              </div>
              <div>
                <div className={`font-medium ${st.state === 'pending' ? 'text-gray-500' : 'text-gray-900'}`}>{st.label}</div>
                {st.sub && <div className={`${st.state === 'current' ? 'text-amber-600' : 'text-gray-500'} text-sm`}>{st.sub}</div>}
                {st.state === 'done' && st.when && (
                  <div className="text-xs text-gray-500">{new Date(st.when).toLocaleString()}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SignatureRequiredCard({
  activeTab,
  setActiveTab,
  typedSig,
  setTypedSig,
  typedStyle,
  setTypedStyle,
  uploadFile: _uploadFile,
  setUploadFile: _setUploadFile,
  consent,
  setConsent,
  canvasRef,
  startDraw,
  draw,
  endDraw,
  clearCanvas,
  canSign,
  onSign,
  role,
  onRequestChanges,
}: {
  activeTab: 'draw' | 'type' | 'upload'
  setActiveTab: (t: 'draw' | 'type' | 'upload') => void
  typedSig: string
  setTypedSig: (v: string) => void
  typedStyle: 'left' | 'right' | null
  setTypedStyle: (s: 'left' | 'right' | null) => void
  uploadFile: File | null
  setUploadFile: (f: File | null) => void
  consent: boolean
  setConsent: (v: boolean) => void
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  startDraw: (e: React.MouseEvent | React.TouchEvent) => void
  draw: (e: React.MouseEvent | React.TouchEvent) => void
  endDraw: (e: React.MouseEvent | React.TouchEvent) => void
  clearCanvas: () => void
  canSign: boolean
  onSign: () => void
  role?: string
  onRequestChanges?: () => void
}) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="text-lg font-semibold text-gray-900 mb-4">Your Signature Required</div>
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg">
        {(['draw','type','upload'] as const).map(tab => (
          <button key={tab} onClick={()=>setActiveTab(tab)} className={`flex-1 py-2 px-4 text-sm font-medium rounded-md ${activeTab===tab ? (role==='owner' ? 'bg-white text-blue-600 shadow-sm' : role==='tenant' ? 'bg-white text-emerald-600 shadow-sm' : 'bg-white text-indigo-600 shadow-sm') : 'text-gray-600 hover:text-gray-800'}`}>{tab.charAt(0).toUpperCase()+tab.slice(1)}</button>
        ))}
      </div>

      {activeTab === 'draw' && (
        <div>
          <div className="signature-pad rounded-lg p-4 mb-3 border-2 border-dashed" style={{height:160, position:'relative' as const}}>
            <canvas
              ref={canvasRef as any}
              className="w-full h-full"
              onMouseDown={startDraw as any}
              onMouseMove={draw as any}
              onMouseUp={endDraw as any}
              onMouseLeave={endDraw as any}
              onTouchStart={startDraw as any}
              onTouchMove={draw as any}
              onTouchEnd={endDraw as any}
            />
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 pointer-events-none">
              <span className="text-sm">Sign here with your finger or mouse</span>
            </div>
          </div>
          <button className="text-sm text-gray-500 hover:text-gray-700 mb-2" onClick={clearCanvas}>Clear signature</button>
        </div>
      )}

      {activeTab === 'type' && (
        <div>
          <input className="w-full p-3 border border-gray-300 rounded-lg mb-3 text-base text-gray-900 placeholder-gray-400" placeholder="Type your full name" value={typedSig} onChange={e=>setTypedSig(e.target.value)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <button
              type="button"
              onClick={()=>setTypedStyle('left')}
              className={`p-4 border-2 rounded-lg text-2xl text-left text-gray-900 ${typedStyle==='left' ? (role==='owner' ? 'border-blue-600' : role==='tenant' ? 'border-emerald-600' : 'border-indigo-600') : 'border-gray-300'}`}
              style={{ fontFamily: `'Brush Script MT','Segoe Script','Apple Chancery','Dancing Script',cursive` }}
            >
              {typedSig || 'Sample Name'}
            </button>
            <button
              type="button"
              onClick={()=>setTypedStyle('right')}
              className={`p-4 border-2 rounded-lg text-2xl text-left text-gray-900 ${typedStyle==='right' ? (role==='owner' ? 'border-blue-600' : role==='tenant' ? 'border-emerald-600' : 'border-indigo-600') : 'border-gray-300'}`}
              style={{ fontFamily: `'Lucida Handwriting','Snell Roundhand','Pacifico','Great Vibes',cursive` }}
            >
              {typedSig || 'Sample Name'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-2 h-56 flex flex-col items-center justify-center">
          <svg className="mx-auto h-10 w-10 text-gray-400 mb-3" fill="none" viewBox="0 0 48 48" stroke="currentColor">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="text-sm text-gray-600">Upload your signature image</div>
          <div className="text-xs text-gray-500 mb-3">PNG, JPG, or SVG up to 2MB</div>
          <input id="signature-upload-input" className="hidden" type="file" accept="image/*,.svg" onChange={(e)=> _setUploadFile?.(e.target.files?.[0] || null)} />
          <label htmlFor="signature-upload-input" className={`mt-1 inline-block px-4 py-2 rounded-lg text-sm font-medium cursor-pointer text-white ${role==='owner' ? 'bg-blue-600 hover:bg-blue-700' : role==='tenant' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>Choose File</label>
        </div>
      )}

      <div className="flex items-start gap-2 mt-2">
        <input type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} />
        <label className="text-sm text-gray-700">I agree that this is my legal signature and I am authorized to sign this contract on behalf of the parties indicated.</label>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-4">
        {(() => {
          const base = role==='owner' ? 'bg-blue-600' : role==='tenant' ? 'bg-emerald-600' : 'bg-indigo-600'
          const hover = role==='owner' ? 'hover:bg-blue-700' : role==='tenant' ? 'hover:bg-emerald-700' : 'hover:bg-indigo-700'
          const enabled = `${base} ${hover} text-white`
          const highlightedDisabled = `${base} text-white opacity-50 cursor-not-allowed`
          const grayDisabled = 'bg-gray-300 text-gray-500 cursor-not-allowed'
          const cls = canSign ? enabled : (consent ? highlightedDisabled : grayDisabled)
          return (
            <button disabled={!canSign} onClick={onSign} className={`flex-1 py-3 px-6 rounded-lg font-medium ${cls}`}>Sign Contract</button>
          )
        })()}
        <button onClick={onRequestChanges} className="flex-1 border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-50">Request Changes</button>
      </div>
    </div>
  )
}

function DocumentCard({ contract, status }: { contract: { pdf_url: string | null; pdf_sha256: string | null }; status: string }) {
  const isReady = status === 'active' || status === 'completed'
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text) } catch { /* no-op */ } }
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="text-lg font-semibold text-gray-900 mb-3">Contract Document</div>
      {!isReady ? (
        <div className="text-center py-8 text-gray-500 text-sm">PDF will be available after all parties sign</div>
      ) : (
        <>
          <a href={contract.pdf_url || '#'} target="_blank" rel="noreferrer" className="block text-center w-full bg-[#2E5BFF] hover:brightness-95 text-white py-3 rounded-lg font-medium mb-4">Download PDF Contract</a>
          {contract.pdf_sha256 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium text-gray-700">Document Hash (SHA256)</div>
                <button onClick={()=> copy(contract.pdf_sha256 || '')} className="text-sm text-blue-600 hover:text-blue-700">Copy</button>
              </div>
              <div className="text-xs text-gray-600 break-all">{contract.pdf_sha256}</div>
              <div className="text-xs text-gray-500 mt-2">Use this hash to verify document integrity</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ActivityCard({ items, role }: { items: { action: string; timestamp: string; actor_role: string | null }[]; role: string | null }) {
  const formatWhen = (ts: string) => {
    try {
      return new Date(ts).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch {
      return ts
    }
  }

  const metaFor = (action: string, actor: string | null) => {
    const act = (action || '').toLowerCase()
    if (act.includes('created') || act === 'created') {
      return { label: 'Contract created', color: 'bg-emerald-100 text-emerald-600', icon: 'check' as const }
    }
    if (act.includes('view') || act === 'viewed') {
      const who = actor ? actor : 'tenant'
      return { label: `Viewed by ${who}`, color: 'bg-amber-100 text-amber-600', icon: 'eye' as const }
    }
    if (act.includes('sent')) {
      return { label: 'Sent', color: 'bg-blue-100 text-blue-600', icon: 'mail' as const }
    }
    if (act.includes('signed')) {
      const who = actor ? actor : 'party'
      return { label: `Signed by ${who}`, color: 'bg-indigo-100 text-indigo-600', icon: 'pen' as const }
    }
    return { label: action || 'event', color: 'bg-gray-100 text-gray-600', icon: 'dot' as const }
  }

  const Icon = ({ type }: { type: 'check' | 'eye' | 'mail' | 'pen' | 'dot' }) => {
    if (type === 'check') {
      return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
      )
    }
    if (type === 'eye') {
      return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" strokeWidth="2"/><circle cx="12" cy="12" r="3" strokeWidth="2"/></svg>
      )
    }
    if (type === 'mail') {
      return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v.217l-8 4.8-8-4.8V5z"/><path d="M18 8.383l-7.445 4.466a1 1 0 01-1.11 0L2 8.383V15a2 2 0 002 2h12a2 2 0 002-2V8.383z"/></svg>
      )
    }
    if (type === 'pen') {
      return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20h9" strokeWidth="2"/><path d="M16.5 3.5l4 4L7 21H3v-4L16.5 3.5z" strokeWidth="2"/></svg>
      )
    }
    return <span className="w-2 h-2 rounded-full bg-current" />
  }

  // Hide self-view events from the same role
  const filtered = items.filter(i => !(i.action === 'viewed' && i.actor_role && role && i.actor_role === role))

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-lg font-semibold text-gray-900">Recent Activity</div>
        <a className="text-sm text-blue-600 hover:text-blue-700" href="#">View All</a>
      </div>
      {filtered.length === 0 && <div className="text-sm text-gray-500">No recent activity.</div>}
      <ul className="space-y-3">
        {filtered.map((a, i)=> {
          const meta = metaFor(a.action, a.actor_role)
          return (
            <li key={i} className="flex items-start gap-3">
              <div className={`w-6 h-6 rounded-full ${meta.color} flex items-center justify-center flex-shrink-0`}>
                <Icon type={meta.icon} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900">{meta.label}</div>
                <div className="text-xs text-gray-500">{formatWhen(a.timestamp)}</div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ContractMessagesCard({ 
  contractId, 
  propertyId, 
  role, 
  vendorName, 
  ownerName, 
  tenantName, 
  isService,
  vendorId,
  ownerId
}: { 
  contractId: string; 
  propertyId: string; 
  role: string | null;
  vendorName: string;
  ownerName: string;
  tenantName: string;
  isService: boolean;
  vendorId?: string;
  ownerId?: string;
}) {
  const { profile } = useAuthStore()
  const [messages, setMessages] = useState<{ id: string; content: string; sender_id: string; sender_name: string; created_at: string }[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true)
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(id, full_name)
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: true })

      if (messagesError) throw messagesError

      console.log('Raw messages data:', messagesData)
      console.log('Property ID being queried:', propertyId)

      const formattedMessages = (messagesData || []).map((msg: any) => {
        const isOwnMessage = (msg.sender_id || '') === (profile?.id || '')
        
        // For own messages, show "You"
        if (isOwnMessage) {
          return {
            id: String(msg.id),
            content: String(msg.content ?? ''),
            sender_id: String(msg.sender_id || ''),
            sender_name: 'You',
            created_at: String(msg.created_at || new Date().toISOString())
          }
        }
        
        // For other messages, determine sender name based on role and contract context
        let senderName = (msg.sender?.full_name as string) || 'Unknown'
        
        // If sender name is still 'Unknown', try to match with contract parties
        if (senderName === 'Unknown' || !msg.sender?.full_name) {
          if (role === 'owner') {
            // Owner is viewing messages - other sender could be vendor or tenant
            if (isService && msg.sender_id === vendorId) {
              senderName = vendorName || 'Vendor'
            } else if (!isService && msg.sender_id === (contractId ? 'tenant_id' : null)) {
              senderName = tenantName || 'Tenant'
            }
          } else if (role === 'vendor') {
            // Vendor is viewing messages - other sender is owner
            if (msg.sender_id === ownerId) {
              senderName = ownerName || 'Owner'
            }
          } else if (role === 'tenant') {
            // Tenant is viewing messages - other sender is owner
            if (msg.sender_id === ownerId) {
              senderName = ownerName || 'Owner'
            }
          }
        }
        
        return {
          id: String(msg.id),
          content: String(msg.content ?? ''),
          sender_id: String(msg.sender_id || ''),
          sender_name: senderName,
          created_at: String(msg.created_at || new Date().toISOString())
        }
      })

      setMessages(formattedMessages)
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setLoading(false)
    }
  }, [propertyId, role, profile?.id, vendorId, ownerId, isService, vendorName, tenantName, ownerName, contractId])

  const sendMessage = async () => {
    if (!newMessage.trim() || !profile?.id) return

    try {
      setSending(true)
      
      // Determine recipient_id based on role and contract type
      let recipientId: string | null = null
      if (role === 'owner' && isService && vendorId) {
        recipientId = vendorId // Owner sending to vendor
      } else if (role === 'vendor' && ownerId) {
        recipientId = ownerId // Vendor sending to owner
      } else if (role === 'tenant' && ownerId) {
        recipientId = ownerId // Tenant sending to owner
      }

      console.log('Sending message:', {
        content: newMessage.trim(),
        sender_id: profile.id,
        property_id: propertyId,
        role: role,
        profile_id: profile.id,
        recipient_id: recipientId,
        vendor_id: vendorId,
        owner_id: ownerId
      })

      const { data: insertData, error: insertError } = await supabase
        .from('messages')
        .insert({
          content: newMessage.trim(),
          sender_id: profile.id,
          property_id: propertyId,
          recipient_id: recipientId
        })
        .select()

      if (insertError) {
        console.error('Message insert error:', insertError)
        throw insertError
      }
      
      console.log('Message inserted successfully:', insertData)

      // Send notification to other parties
      if (role === 'owner' && isService) {
        // Notify vendor if this is a service contract
        // We need to get the vendor ID from the contract context
        // For now, skip notification to avoid errors
        console.log('Owner message sent - notification skipped due to missing vendor context')
      }

      setNewMessage('')
      await loadMessages() // Reload messages
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="text-lg font-semibold text-gray-900 mb-3">Messages</div>
      
      {/* Messages List */}
      <div className="max-h-64 overflow-y-auto mb-4 space-y-3">
        {loading ? (
          <div className="text-sm text-gray-500">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-gray-500">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.sender_id === profile?.id
            return (
              <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                  isOwnMessage 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-xs">{message.sender_name}</span>
                    <span className="text-xs opacity-70">{formatTime(message.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={sending}
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim() || sending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

function FooterCard({ canSign, onSign, role }: { canSign: boolean; onSign: ()=>void; role?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4 sticky bottom-4">
      <div className="flex gap-3">
        <button onClick={()=>history.back()} className="flex-1 border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-medium">Back</button>
        <button onClick={onSign} disabled={!canSign} className={`flex-1 ${role==='owner' ? 'bg-blue-600 hover:bg-blue-700' : role==='tenant' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-50 text-white py-3 px-6 rounded-lg font-medium`}>
          Sign Contract
        </button>
      </div>
    </div>
  )
}



