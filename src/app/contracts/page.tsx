'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

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

export default function ContractDetailPage() {
	const params = useSearchParams()
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
	const isOwner = role === 'owner'
	const isTenant = role === 'tenant'
	const isService = !!serviceContract
	const currentParty = getCurrentPartyRole()

	async function loadAncillary(kind: 'service' | 'tenancy', row: ServiceContract | TenancyContract) {
		try {
			// Parties (use SECURITY DEFINER RPC to avoid RLS issues for cross-profile reads)
			const resolveMinimal = async (userId: string | null | undefined) => {
				if (!userId) return null
				const res = await (supabase as any).rpc('get_profile_minimal', { uid: userId as any })
				const data = Array.isArray(res.data) ? res.data[0] : (res.data as any)
				return data || null
			}

			const owner = await resolveMinimal(row.owner_id)
			if (owner) {
				setOwnerName(owner.full_name || 'Owner')
				setOwnerEmail(owner.email || '')
			} else {
				setOwnerName('Owner')
				setOwnerEmail('')
			}

			if ('tenant_id' in row && row.tenant_id) {
				const tenant = await resolveMinimal(row.tenant_id)
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
				const vendor = await resolveMinimal((row as ServiceContract).vendor_id)
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
			// Signatures list
			const sigTable = kind === 'service' ? 'service_contract_signatures' : 'tenancy_contract_signatures'
			const sigRes = await supabase.from(sigTable).select('signer_role,signed_at').eq('contract_id', row.id).order('signed_at', { ascending: true })
			setSigs(sigRes.data || [])

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
		<div className={`${role === 'owner' ? 'bg-gradient-to-b from-blue-50 to-white' : role === 'tenant' ? 'bg-gradient-to-b from-green-50 to-white' : ''}`}>
			{/* Header */}
			<div className={`px-4 py-4 ${role === 'owner' ? 'bg-gradient-to-r from-blue-700 to-blue-600' : role === 'tenant' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500' : 'bg-slate-800'}`}>
				<div className="max-w-3xl mx-auto text-white">
					<div className="text-xl font-bold">Contract Details</div>
					<div className="mt-1 text-xs opacity-90">
						<span className="bg-white/20 px-2 py-0.5 rounded-full">{role || 'Viewer'}</span>
					</div>
				</div>
			</div>

			{/* Body */}
			<div className="max-w-3xl mx-auto p-4 space-y-4">
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
						<ProgressCard status={statusPill} sigs={sigs} />
						{statusPill === 'pending_signatures' && !hasSigned(currentParty || undefined) && (
							<SignatureRequiredCard
								activeTab={activeTab}
								setActiveTab={setActiveTab}
								typedSig={typedSig}
								setTypedSig={setTypedSig}
								typedStyle={typedStyle}
								setTypedStyle={setTypedStyle}
								uploadFile={uploadFile}
								setUploadFile={setUploadFile}
								consent={consent}
								setConsent={setConsent}
								canvasRef={canvasRef}
								startDraw={startDraw}
								draw={draw}
								endDraw={endDraw}
								clearCanvas={clearCanvas}
								canSign={canSignInline()}
								onSign={handleSign}
								role={role}
							/>
						)}
						<DocumentCard contract={contract} status={statusPill} />
					<ActivityCard items={audit} role={role || null} />
					<FooterCard
						canSign={statusPill === 'pending_signatures' && !hasSigned(currentParty || undefined) ? canSignInline() : false}
						onSign={handleSign}
						role={role}
					/>
					</>
				)}
			</div>
		</div>
	)
}

function Signatures({ contractId, isService }: { contractId: string; isService: boolean }) {
  const [sigs, setSigs] = useState<{ signer_role: string; signed_at: string }[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    const load = async () => {
      try {
        const table = isService ? 'service_contract_signatures' : 'tenancy_contract_signatures'
        const { data } = await supabase
          .from(table)
          .select('signer_role,signed_at')
          .eq('contract_id', contractId)
          .order('signed_at', { ascending: true })
        setSigs(data || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load signatures')
      }
    }
    load()
  }, [contractId, isService])
  if (error) return <div className="text-sm text-red-600">{error}</div>
  return (
    <div className="border rounded p-3">
      <div className="font-medium mb-2">Signatures</div>
      {sigs.length === 0 && <div className="text-sm text-gray-500">No signatures yet.</div>}
      <ul className="text-sm text-gray-700 space-y-1">
        {sigs.map((s, idx) => (
          <li key={idx}>{s.signer_role} • {new Date(s.signed_at).toLocaleString()}</li>
        ))}
      </ul>
    </div>
  )
}

function InlineSign({ contractId, isService, status }: { contractId: string; isService: boolean; status: string }) {
  const { profile } = useAuthStore()
  const isOwner = profile?.role === 'owner'
  const isTenant = profile?.role === 'tenant'
  const [consent, setConsent] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState('')

  if (status !== 'pending_signatures' || (!isOwner && !isTenant)) return null

  const handleSign = async () => {
    try {
      let signatureUrl: string | null = null
      if (file) {
        const path = `signatures/${contractId}/${profile?.id || 'user'}-${Date.now()}-${file.name}`
        const up = await supabase.storage.from('contracts').upload(path, file, { upsert: true })
        if (up.error) throw up.error
        signatureUrl = up.data?.path || path
      }
      const table = isService ? 'service_contract_signatures' : 'tenancy_contract_signatures'
      const role = isOwner ? 'owner' : 'tenant'
      const ins = await supabase.from(table).insert({
        contract_id: contractId,
        signer_role: role,
        signer_id: profile?.id || '',
        signature_image_url: signatureUrl || 'uploaded-in-external-system',
        signed_at: new Date().toISOString(),
      })
      if (ins.error) throw ins.error
      setMsg('Signed successfully')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed to sign')
    }
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-lg font-semibold text-gray-900 mb-3">Your Signature</div>
      <div className="text-sm text-gray-600 mb-2">Upload signature image (PNG/JPG). In-app signature pad coming next.</div>
      <input type="file" accept="image/*" onChange={(e)=> setFile(e.target.files?.[0] || null)} />
      <div className="flex items-start gap-2 mt-3">
        <input type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} />
        <label className="text-sm text-gray-700">I agree this is my legal signature</label>
      </div>
      <button className="mt-3 bg-sa-blue-500 hover:bg-sa-blue-600 text-white px-4 py-2 rounded disabled:opacity-50" disabled={!consent} onClick={handleSign}>Sign now</button>
      {msg && <div className="mt-2 text-sm text-gray-700">{msg}</div>}
    </div>
  )
}

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

function ProgressCard({ status, sigs }: { status: string; sigs: { signer_role: string; signed_at: string }[] }) {
  const ownerSig = sigs.find(s => s.signer_role === 'owner')
  const tenantSig = sigs.find(s => s.signer_role === 'tenant')

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

  const stepOwner = { key: 'signed_owner', label: 'Signed by Owner', sub: signedByOwnerState === 'current' ? 'Waiting for signature' : (signedByOwnerState === 'pending' ? 'Pending' : undefined), state: signedByOwnerState, when: ownerSig?.signed_at }
  const stepTenant = { key: 'signed_tenant', label: 'Signed by Tenant', sub: signedByTenantState === 'current' ? 'Waiting for signature' : (signedByTenantState === 'pending' ? 'Pending' : undefined), state: signedByTenantState, when: tenantSig?.signed_at }
  const thirdIsOwner = ownerSigned && !tenantSigned
  const steps: { key: string; label: string; sub?: string; state: StepState; when?: string }[] = [
    { key: 'created', label: 'Created', state: 'done' },
    { key: 'sent', label: 'Sent', state: 'done' },
    thirdIsOwner ? stepOwner : stepTenant,
    thirdIsOwner ? stepTenant : stepOwner,
    { key: 'active', label: 'Active', sub: activeState === 'pending' ? 'Pending' : undefined, state: activeState },
  ]

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
  uploadFile,
  setUploadFile,
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
          <input id="signature-upload-input" className="hidden" type="file" accept="image/*,.svg" onChange={(e)=> setUploadFile(e.target.files?.[0] || null)} />
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
        <button className="flex-1 border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-50">Request Changes</button>
      </div>
    </div>
  )
}

function DocumentCard({ contract, status }: { contract: { pdf_url: string | null; pdf_sha256: string | null }; status: string }) {
  const isReady = status === 'active' || status === 'completed'
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
              <div className="text-sm font-medium text-gray-700 mb-1">Document Hash (SHA256)</div>
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



