'use client'

import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import ContractsTabs, { VendorContractRow } from '@/components/Vendor/ContractsTabs'
import JobsList from '@/components/Vendor/JobsList'
import BottomNavbar from '@/components/BottomNavbar'

type ServiceContractRow = { id: string; title: string | null; status: string | null; property_id: string; terms?: { total?: number; due_text?: string } | null }
type PurchaseOrderRow = { id: string; contract_id: string; status: string | null }
type JobExecutionRow = { id: string; contract_id: string; status: string | null }
type QuoteRow = { id: string; contract_id: string; status: string | null; total_amount: number | null }

export default function VendorJobsPage() {
  const { user } = useAuthStore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabase
  const [rows, setRows] = useState<VendorContractRow[]>([])
  const [filter, setFilter] = useState<'all'|'pending'|'active'|'completed'>('all')
  const [available, setAvailable] = useState<VendorContractRow[]>([])
  const [openCurrent, setOpenCurrent] = useState<boolean>(false)
  const [openOpenJobs, setOpenOpenJobs] = useState<boolean>(false)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { data: ctr } = await sb.from('service_contracts' as string).select('id,title,status,property_id,terms').eq('vendor_id', user.id).order('created_at', { ascending: false })
      const { data: poRows } = await sb.from('purchase_orders' as string).select('id,contract_id,status')
      const { data: execRows } = await sb.from('job_executions' as string).select('id,contract_id,status')
      const { data: quoteRows } = await sb.from('quotes' as string).select('id,contract_id,status,total_amount')
      // Available: simplified placeholder (later: maintenance_requests routed to vendor)
      const { data: availCtr } = await sb.from('service_contracts' as string).select('id,title,status,property_id,terms').eq('status', 'pending_signatures').order('created_at', { ascending: false })

      const poByContract = new Map<string,string>()
      ;(poRows||[] as PurchaseOrderRow[]).forEach((p: PurchaseOrderRow)=>{ poByContract.set(p.contract_id, p.status || 'po_issued') })
      const execByContract = new Map<string,string>()
      ;(execRows||[] as JobExecutionRow[]).forEach((e: JobExecutionRow)=>{ execByContract.set(e.contract_id, e.status || 'not_started') })
      const quoteByContract = new Map<string, { status: string; total: number|null }>()
      ;(quoteRows||[] as QuoteRow[]).forEach((q: QuoteRow)=>{ quoteByContract.set(q.contract_id, { status: q.status || 'requested', total: q.total_amount ?? null }) })

      const mapped: VendorContractRow[] = ((ctr||[]) as ServiceContractRow[]).map(r => {
        const quoteStatus = quoteByContract.get(r.id)?.status || null
        const poStatus = poByContract.get(r.id) || 'none'
        const execStatus = execByContract.get(r.id) || 'not_started'
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
      })
      setRows(mapped)
      // Available jobs: those not yet assigned to this vendor (for now, pending_signatures not owned by vendor)
      const availMapped: VendorContractRow[] = ((availCtr||[]) as ServiceContractRow[])
        .filter((r)=> !(ctr||[]).some((mine: ServiceContractRow)=> mine.id === r.id))
        .map(r => ({ id: r.id, title: r.title || 'Service Contract', status: r.status || 'pending_signatures', property_label: r.property_id, total_amount: r.terms?.total || null, due_text: r.terms?.due_text || null, po_status: 'none', exec_status: 'not_started', quote_status: 'requested', friendly_status: 'Quote Requested', cta: { label: 'Submit Quote', href: `/dashboard/vendor/quotes/new?contract_id=${r.id}` } }))
      setAvailable(availMapped)
    }
    load()
  }, [user, sb])

  // Expand "All Open Jobs" when deep-linked from dashboard; rely on native anchor for scroll
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash === '#open-jobs') {
      setOpenOpenJobs(true)
    } else if (window.location.hash === '#current-jobs') {
      setOpenCurrent(true)
    }
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    if (filter === 'pending') return rows.filter(r => r.status === 'pending_signatures')
    if (filter === 'active') return rows.filter(r => r.status === 'active')
    return rows.filter(r => r.status === 'completed')
  }, [rows, filter])

  return (
    <ProtectedRoute allowedRoles={['vendor']}>
      <div className="max-w-sm mx-auto bg-white min-h-screen pb-20">
        <div className="px-4 py-4 flex items-center justify-between">
          <h1 className="font-semibold text-gray-900">Jobs</h1>
          <div className="flex items-center gap-2 text-xs">
            {(['all','pending','active','completed'] as const).map(k => (
              <button key={k} onClick={()=>setFilter(k)} className={`px-2 py-1 rounded-full border ${filter===k ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-600 border-gray-200'}`}>{k}</button>
            ))}
          </div>
        </div>
        <div className="px-4 pb-4 space-y-6">
          <div id="current-jobs" className="bg-white rounded-lg shadow">
            <button onClick={()=>setOpenCurrent(v=>!v)} className="w-full p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Current Jobs</h3>
              <span className="text-gray-500 text-sm">{openCurrent ? '▾' : '▸'}</span>
            </button>
            {openCurrent && (
              <div className="p-0">
                <JobsList rows={filtered} />
              </div>
            )}
          </div>
          <div id="open-jobs" className="bg-white rounded-lg shadow">
            <button onClick={()=>setOpenOpenJobs(v=>!v)} className="w-full p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">All Open Jobs</h3>
              <span className="text-gray-500 text-sm">{openOpenJobs ? '▾' : '▸'}</span>
            </button>
            {openOpenJobs && (
              <div className="p-0">
                <JobsList rows={available} />
              </div>
            )}
          </div>
        </div>
        <BottomNavbar userRole="vendor" />
      </div>
    </ProtectedRoute>
  )
}


