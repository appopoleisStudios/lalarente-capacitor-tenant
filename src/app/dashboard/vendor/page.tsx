'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import VendorHeader from '@/components/Vendor/VendorHeader'
import MetricsStrip from '@/components/Vendor/MetricsStrip'
import ContractsTabs, { VendorContractRow } from '@/components/Vendor/ContractsTabs'
import QuickActions from '@/components/Vendor/QuickActions'
import BottomNavbar from '@/components/BottomNavbar'

type NewServiceForm = {
  title: string
  description: string
  base_price: string
  pricing_unit: string
}

type NewContractForm = {
  property_id: string
  owner_id: string
  tenant_id?: string
  title: string
}

export default function VendorDashboardPage() {
  const { user, signOut } = useAuthStore()
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabase

  type VendorService = { id: string; title?: string; description?: string | null; base_price?: number | null; pricing_unit?: string | null }
  const [services, setServices] = useState<VendorService[]>([])
  const [pending, setPending] = useState<VendorContractRow[]>([])
  const [activeRows, setActiveRows] = useState<VendorContractRow[]>([])
  const [completedRows, setCompletedRows] = useState<VendorContractRow[]>([])
  // Opportunities removed per latest UX; header CTA can later route to a dedicated page
  const [serviceForm, setServiceForm] = useState<NewServiceForm>({ title: '', description: '', base_price: '', pricing_unit: '' })
  const [contractForm, setContractForm] = useState<NewContractForm>({ property_id: '', owner_id: '', tenant_id: '', title: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string>('')

  // vendor-only route enforced by ProtectedRoute

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const { data: svc } = await sb.from('vendor_services' as string).select('id,title,description,base_price,pricing_unit').eq('vendor_id', user.id).order('created_at', { ascending: false })
        setServices(svc || [])
        const { data: ctr } = await sb.from('service_contracts' as string).select('id,title,status,property_id,terms').eq('vendor_id', user.id).order('created_at', { ascending: false })
        // Fetch PO and execution snapshots
        const { data: poRows } = await sb.from('purchase_orders' as string).select('id,contract_id,status')
        const { data: execRows } = await sb.from('job_executions' as string).select('id,contract_id,status')
        const { data: quoteRows } = await sb.from('quotes' as string).select('id,contract_id,status,total_amount')

        type PurchaseOrderRow = { id: string; contract_id: string; status: string | null }
        type JobExecutionRow = { id: string; contract_id: string; status: string | null }
        type QuoteRow = { id: string; contract_id: string; status: string | null; total_amount: number | null }

        const poByContract = new Map<string,string>()
        ;(poRows||[] as PurchaseOrderRow[]).forEach((p: PurchaseOrderRow)=>{ poByContract.set(p.contract_id, p.status || 'po_issued') })
        const execByContract = new Map<string,string>()
        ;(execRows||[] as JobExecutionRow[]).forEach((e: JobExecutionRow)=>{ execByContract.set(e.contract_id, e.status || 'not_started') })
        const quoteByContract = new Map<string, { status: string; total: number|null }>()
        ;(quoteRows||[] as QuoteRow[]).forEach((q: QuoteRow)=>{ quoteByContract.set(q.contract_id, { status: q.status || 'requested', total: q.total_amount ?? null }) })

        type ServiceContractRow = { id: string; title: string | null; status: string | null; property_id: string; terms?: { total?: number; due_text?: string } | null }
        const mapRow = (r: ServiceContractRow): VendorContractRow => {
          const quoteStatus = quoteByContract.get(r.id)?.status || null
          const poStatus = poByContract.get(r.id) || 'none'
          const execStatus = execByContract.get(r.id) || 'not_started'
          // Friendly status + CTA
          let friendly = r.status || 'pending_signatures'
          let cta = { label: 'View Details', href: `/contracts?id=${r.id}` }
          if (quoteStatus === 'requested' || quoteStatus === 'change_requested') {
            friendly = 'Quote Requested'
            cta = { label: 'Submit Quote', href: `/dashboard/vendor/quotes/new?contract_id=${r.id}` }
          } else if (poStatus === 'po_issued') {
            friendly = 'PO Issued'
          } else if (execStatus === 'in_progress') {
            friendly = 'In Progress'
          } else if (execStatus === 'completed') {
            friendly = 'Completed'
          }

          return {
            id: r.id,
            title: r.title || 'Service Contract',
            status: r.status || 'pending_signatures',
            property_label: r.property_id,
            total_amount: (quoteByContract.get(r.id)?.total ?? r.terms?.total) || null,
            due_text: r.terms?.due_text || null,
            po_status: poStatus,
            exec_status: execStatus,
            quote_status: quoteStatus,
            friendly_status: friendly,
            cta,
          }
        }
        const rows: VendorContractRow[] = ((ctr || []) as ServiceContractRow[]).map(mapRow)
        setPending(rows.filter((r: VendorContractRow)=> r.status==='pending_signatures'))
        setActiveRows(rows.filter((r: VendorContractRow)=> r.status==='active'))
        setCompletedRows(rows.filter((r: VendorContractRow)=> r.status==='completed'))

        // Opportunities (MVP: open maintenance_requests)
        // opportunities feed removed from Home screen; keep for future page
      } catch {
        // ignore for scaffold
      }
    }
    load()
  }, [user, sb])

  const createService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setMsg('')
    try {
      const basePrice = parseFloat(serviceForm.base_price || '0')
      const { error } = await sb.from('vendor_services' as string).insert({
        vendor_id: user.id,
        title: serviceForm.title.trim(),
        description: serviceForm.description.trim() || null,
        base_price: isNaN(basePrice) ? 0 : basePrice,
        pricing_unit: serviceForm.pricing_unit.trim() || null,
      })
      if (error) throw error
      setServiceForm({ title: '', description: '', base_price: '', pricing_unit: '' })
      const { data: svc } = await sb.from('vendor_services' as string).select('*').eq('vendor_id', user.id).order('created_at', { ascending: false })
      setServices(svc || [])
      setMsg('Service created')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create service'
      setMsg(message)
    } finally {
      setLoading(false)
    }
  }

  const createContract = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setMsg('')
    try {
      const payload = {
        vendor_id: user.id,
        property_id: contractForm.property_id.trim(),
        owner_id: contractForm.owner_id.trim(),
        title: contractForm.title.trim(),
        status: 'pending_signatures',
      }
      const withTenant = contractForm.tenant_id && contractForm.tenant_id.trim() ? { ...payload, tenant_id: contractForm.tenant_id.trim() } : payload
      const { error } = await sb.from('service_contracts' as string).insert(withTenant as unknown as Record<string, unknown>)
      if (error) throw error
      setContractForm({ property_id: '', owner_id: '', tenant_id: '', title: '' })
      const { data: ctr } = await sb.from('service_contracts' as string).select('id,title,status,property_id,terms').eq('vendor_id', user.id).order('created_at', { ascending: false })
      type ServiceContractRow2 = { id: string; title: string | null; status: string | null; property_id: string; terms?: { total?: number; due_text?: string } | null }
      const mapRow = (r: ServiceContractRow2): VendorContractRow => ({ id: r.id, title: r.title || 'Service Contract', status: r.status || 'pending_signatures', property_label: r.property_id, total_amount: r.terms?.total || null, due_text: r.terms?.due_text || null })
      const rows: VendorContractRow[] = ((ctr || []) as ServiceContractRow2[]).map(mapRow)
      setPending(rows.filter((r: VendorContractRow)=> r.status==='pending_signatures'))
      setActiveRows(rows.filter((r: VendorContractRow)=> r.status==='active'))
      setCompletedRows(rows.filter((r: VendorContractRow)=> r.status==='completed'))
      setMsg('Contract created')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create contract'
      setMsg(message)
    } finally {
      setLoading(false)
    }
  }

  const signContractAsVendor = async (contractId: string, file: File | null) => {
    if (!user) return
    setLoading(true)
    setMsg('')
    try {
      let signatureUrl: string | null = null
      if (file) {
        const path = `signatures/${contractId}/${user.id}-${Date.now()}-${file.name}`
        const { data, error } = await supabase.storage.from('contracts').upload(path, file, { upsert: true })
        if (error) throw error
        signatureUrl = data?.path || path
      }
      const { error: insertError } = await sb.from('service_contract_signatures' as string).insert({
        contract_id: contractId,
        signer_role: 'vendor',
        signer_id: user.id,
        signature_image_url: signatureUrl || 'uploaded-in-external-system',
        signed_at: new Date().toISOString(),
      })
      if (insertError) throw insertError
      setMsg('Signed successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign'
      setMsg(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['vendor']}>
      <div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden" data-testid="vendor-dashboard">
        <VendorHeader />
        {msg && <div className="m-4 p-3 rounded border border-gray-200 bg-gray-50 text-gray-700">{msg}</div>}
        <main className="px-4 py-4 space-y-4">
          <MetricsStrip
            activeJobs={activeRows.length}
            thisMonth={activeRows.filter(r=>{
              const d = new Date(); const ym = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`; return true
            }).length}
            earnings={completedRows.reduce((a,b)=> a + (b.total_amount || 0), 0)}
            rating={4.8}
            onAvailableJobs={()=>{ router.push('/dashboard/vendor/jobs#open-jobs') }}
            onSchedule={()=>{}}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">📈</span>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">+12%</span>
              </div>
              <p className="text-sm text-gray-600">Monthly Revenue</p>
              <p className="text-lg font-bold text-gray-900">R {completedRows.reduce((a,b)=> a + (b.total_amount || 0), 0).toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">⏰</span>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{completedRows.length}</span>
              </div>
              <p className="text-sm text-gray-600">Jobs Completed</p>
              <p className="text-lg font-bold text-gray-900">{completedRows.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">📋</span>
                <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">{pending.length}</span>
              </div>
              <p className="text-sm text-gray-600">Open Quotes</p>
              <p className="text-lg font-bold text-gray-900">{pending.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">⭐</span>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">4.8</span>
              </div>
              <p className="text-sm text-gray-600">Customer Rating</p>
              <p className="text-lg font-bold text-gray-900">4.8/5</p>
            </div>
          </div>

          <QuickActions actions={[
            { key:'earn', label:'Earnings', emoji:'💰', onClick:()=>{ router.push('/dashboard/vendor/payments') } },
            { key:'reviews', label:'Reviews', emoji:'⭐', onClick:()=>{} },
            { key:'docs', label:'Documents', emoji:'📄', onClick:()=>{} },
            { key:'support', label:'Support', emoji:'📞', onClick:()=>{} },
          ]} />

          <ContractsTabs pending={pending} active={activeRows} completed={completedRows} />
          {/* Recent Payments card placeholder to match layout; implement from payments table later */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Recent Payments</h3>
              <a href="#" className="text-blue-600 text-sm font-medium">View All</a>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-gray-900">Bathroom Renovation</h4>
                  <span className="bg-emerald-600 text-white text-xs px-2 py-1 rounded-full">Paid</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">Jan 15, 2024</p>
                  <span className="text-sm font-semibold text-emerald-600">R 5,200</span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-gray-900">Kitchen Plumbing</h4>
                  <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full">Pending</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">Jan 12, 2024</p>
                  <span className="text-sm font-semibold text-gray-900">R 2,800</span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-gray-900">Electrical Repairs</h4>
                  <span className="bg-emerald-600 text-white text-xs px-2 py-1 rounded-full">Paid</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">Jan 10, 2024</p>
                  <span className="text-sm font-semibold text-emerald-600">R 1,650</span>
                </div>
              </div>
            </div>
          </div>
        </main>
        <BottomNavbar userRole="vendor" />
      </div>
    </ProtectedRoute>
  )
}


