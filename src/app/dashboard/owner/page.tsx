'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import BottomNavbar from '@/components/BottomNavbar'
import { supabase } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'

export default function OwnerDashboardPage() {
  const router = useRouter()
  const { profile, user } = useAuthStore()

  // Derived metrics
  const [metrics, setMetrics] = useState({
    totalUnits: 0,
    occupied: 0,
    vacant: 0,
    monthIncome: 0,
    arrears: 0,
    occupancy: 0
  })

  const [documentsCounts, setDocumentsCounts] = useState({
    leases: 0,
    invoices: 0,
    quotes: 0,
    tax: 0,
    compliance: 0
  })

  type MRList = { id: string; title: string; property_label: string; status: string; quote?: number|null; invoice?: number|null; color?: string }
  const [maintenance, setMaintenance] = useState<MRList[]>([])

  type Applicant = { avatar: string; name: string; property: string; status: string; date: string }
  const [applicants] = useState<Applicant[]>([])

  type ActivityRow = { icon: string; color: string; label: string; value: string; date: string }
  const [recentActivity, setRecentActivity] = useState<ActivityRow[]>([])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      // Step 1: fetch owner properties (ids + titles)
      const { data: props } = await supabase
        .from('properties')
        .select('id,title')
        .eq('owner_id', user.id)
        .order('title')
      const propertyIds = (props || []).map(p => p.id)
      const totalUnits = propertyIds.length

      // Step 2: in parallel, fetch active leases count, month income, and maintenance list
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0)
      const startISO = startOfMonth.toISOString()

      const [leasesCountRes, paidRes, mrRes] = await Promise.all([
        propertyIds.length > 0
          ? supabase.from('leases').select('*', { count: 'exact', head: true }).in('property_id', propertyIds)
              .lte('lease_start', new Date().toISOString()).gte('lease_end', new Date().toISOString())
          : Promise.resolve({ count: 0 }),
        propertyIds.length > 0
          ? supabase.from('payments').select('amount,property_id,paid_date,status')
              .in('property_id', propertyIds)
              .gte('paid_date', startISO)
              .eq('status', 'paid')
          : Promise.resolve({ data: [] }),
        supabase
          .from('maintenance_requests')
          .select('id,title,priority,mms_status,created_at,property_id')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)
      ])

      const occupied = (leasesCountRes as { count: number }).count || 0
      const vacant = Math.max(totalUnits - occupied, 0)
      const monthIncome = (paidRes.data || []).reduce((sum: number, r: { amount: number }) => sum + (Number(r.amount) || 0), 0)
      const occupancy = totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0

      setMetrics({ totalUnits, occupied, vacant, monthIncome, arrears: 0, occupancy })

      // Step 3: documents counts (batched)
      const [leasesCountOnly, scRes] = await Promise.all([
        propertyIds.length > 0
          ? supabase.from('leases').select('*', { count: 'exact', head: true }).in('property_id', propertyIds)
          : Promise.resolve({ count: 0 }),
        supabase.from('service_contracts').select('id').eq('owner_id', user.id)
      ])
      const contractIds = (scRes.data || []).map((r: { id: string }) => r.id)
      const [poRes, ownerMRRes, quotesRes] = await Promise.all([
        contractIds.length > 0
          ? supabase.from('purchase_orders').select('id,contract_id').in('contract_id', contractIds)
          : Promise.resolve({ data: [] }),
        supabase.from('maintenance_requests').select('id').eq('owner_id', user.id),
        // quotes for owner requests
        supabase.from('quotes').select('id,request_id')
      ])
      const ownerRequestIds = (ownerMRRes.data || []).map((r: { id: string }) => r.id)
      const quotesCount = (quotesRes.data || []).filter((q: { request_id: string|null }) => q.request_id && ownerRequestIds.includes(q.request_id)).length
      setDocumentsCounts({
        leases: (leasesCountOnly as { count: number }).count || 0,
        invoices: (poRes.data || []).length,
        quotes: quotesCount,
        tax: 0,
        compliance: 0
      })

      // Step 4: map maintenance quick view items
      const mrList = (mrRes.data || []).map((r: { id: string; title: string; priority: string | null; mms_status: string | null }) => ({
        id: r.id,
        title: r.title,
        property_label: '',
        status: r.mms_status || 'open',
        quote: null,
        invoice: null,
        color: (r.priority || 'medium') === 'high' ? 'red-500' : (r.priority || 'medium') === 'low' ? 'green-500' : 'yellow-500'
      }))
      setMaintenance(mrList)

      // Step 5: recent activity (last 5 audit events on owner's requests)
      const { data: ownerReqs } = await supabase.from('maintenance_requests').select('id').eq('owner_id', user.id)
      const reqIds = (ownerReqs || []).map(r => r.id)
      if (reqIds.length > 0) {
        const { data: audits } = await supabase
          .from('maintenance_request_audit_logs')
          .select('event,created_at')
          .in('request_id', reqIds)
          .order('created_at', { ascending: false })
          .limit(5)
        // mapIcon was unused
        const acts: ActivityRow[] = (audits || []).map(a => ({
          icon: 'fas fa-info-circle',
          color: 'blue-600',
          label: a.event.replace(/_/g, ' '),
          value: '',
          date: new Date(a.created_at as string).toLocaleDateString()
        }))
        setRecentActivity(acts)
      } else {
        setRecentActivity([])
      }
    }
    load()
  }, [user])

  const documents = useMemo(() => ([
    { name: 'Lease Contracts', icon: 'fas fa-file-signature', type: 'lease', count: documentsCounts.leases, info: 'Active/Past' },
    { name: 'Invoices', icon: 'fas fa-file-invoice-dollar', type: 'invoice', count: documentsCounts.invoices, info: 'Latest' },
    { name: 'Vendor Quotes', icon: 'fas fa-file-contract', type: 'quote', count: documentsCounts.quotes, info: 'For Review' },
    { name: 'Tax Reports', icon: 'fas fa-balance-scale', type: 'tax', count: documentsCounts.tax, info: 'Annual/CSV' },
    { name: 'Compliance Docs', icon: 'fas fa-shield-alt', type: 'compliance', count: documentsCounts.compliance, info: 'FICA, COC' }
  ]), [documentsCounts])

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div className="max-w-md mx-auto min-h-screen shadow-xl bg-gradient-to-b from-blue-50 to-white relative overflow-hidden pb-32">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-5 pointer-events-none select-none">
          <div className="absolute top-20 left-12 w-16 h-16 border border-blue-600 rounded-full"/>
          <div className="absolute bottom-40 right-8 w-20 h-20 border border-yellow-500 rounded-full"/>
          <div className="absolute top-1/3 right-6 w-12 h-12 border border-green-600 rounded-full"/>
        </div>

        {/* Header */}
        <div className="bg-white shadow-sm p-4 relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Portfolio Dashboard</h1>
              <p className="text-sm text-blue-700 font-medium">Welcome back, {profile?.full_name || 'Owner'}</p>
            </div>
          </div>
          <button className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition">
            <i className="fas fa-bell text-blue-600"></i>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-white">3</span>
            </div>
          </button>
        </div>

        <div className="p-6 relative z-10">

          {/* Portfolio Summary */}
          <div className="bg-gradient-to-r from-blue-700 to-blue-600 rounded-xl p-6 text-white mb-7 shadow-lg">
            <div className="flex items-center mb-3">
              <i className="fas fa-building text-5xl bg-white/20 rounded-full p-3"></i>
              <div className="ml-4">
                <div className="text-lg font-bold">My Portfolio</div>
                <div className="text-sm text-blue-100">
                  Units: <b>{metrics.totalUnits}</b> | Occupied: <b>{metrics.occupied}</b> | Vacant: <b>{metrics.vacant}</b>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between my-2">
              <div>
                <div className="text-blue-200 text-sm font-medium">Monthly Rent</div>
                <div className="text-xl font-extrabold">R {metrics.monthIncome.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-blue-200 text-sm font-medium">In Arrears</div>
                <div className="text-xl font-bold text-yellow-100">R {metrics.arrears.toLocaleString()}</div>
              </div>
            </div>
            <div className="flex gap-4 mt-2">
              <button
                onClick={() => router.push('/dashboard/owner/properties')}
                className="bg-white/90 text-blue-700 rounded-lg px-3 py-2 text-sm font-semibold shadow hover:bg-blue-50 transition"
              >
                View Properties
              </button>
              <button
                onClick={() => router.push('/dashboard/owner/income')}
                className="bg-white/90 text-emerald-700 rounded-lg px-3 py-2 text-sm font-semibold shadow hover:bg-emerald-50 transition"
              >
                Earnings Report
              </button>

              <button
                onClick={() => router.push('/dashboard/owner/dedicated-vendors')}
                className="bg-white/90 text-indigo-700 rounded-lg px-3 py-2 text-sm font-semibold shadow hover:bg-indigo-50 transition"
              >
                My Vendors
              </button>
            </div>
          </div>

          {/* Key Analytics */}
          <div className="grid grid-cols-2 gap-4 mb-7">
  <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-4 flex flex-col items-center">
    <i className="fas fa-coins text-emerald-600 text-2xl mb-1" />
    <div className="font-extrabold text-xl text-gray-900">R {metrics.monthIncome.toLocaleString()}</div>
    <div className="text-sm text-gray-700 font-semibold mt-1">This Month Income</div>
  </div>
  <div className="bg-white rounded-lg shadow-sm border border-emerald-100 p-4 flex flex-col items-center">
    <i className="fas fa-chart-line text-blue-500 text-2xl mb-1" />
    <div className="font-extrabold text-xl text-gray-900">{metrics.occupancy}%</div>
    <div className="text-sm text-gray-700 font-semibold mt-1">Current Occupancy</div>
  </div>
  <div className="bg-white rounded-lg shadow-sm border border-yellow-100 p-4 flex flex-col items-center">
    <i className="fas fa-user-clock text-yellow-500 text-2xl mb-1" />
    <div className="font-extrabold text-xl text-gray-900">0</div>
    <div className="text-sm text-gray-700 font-semibold mt-1">Tenants In Arrears</div>
  </div>
  <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-4 flex flex-col items-center">
    <i className="fas fa-tools text-blue-600 text-2xl mb-1" />
    <div className="font-extrabold text-xl text-gray-900">{maintenance.length}</div>
    <div className="text-sm text-gray-700 font-semibold mt-1">Open Maintenance</div>
  </div>
</div>



          {/* Documents Center */}
          <div className="mb-7">
  <div className="flex items-center justify-between mb-2">
    <h3 className="text-lg font-semibold text-gray-900">My Documents</h3>
    <button
      onClick={() => router.push('/dashboard/owner/documents')}
      className="text-sm text-blue-700 font-semibold hover:text-blue-900"
    >
      See All
    </button>
  </div>
  <div className="grid grid-cols-3 gap-3">
  {documents.map((doc) => (
    <button
      key={doc.type}
      className="bg-white rounded-lg border border-gray-100 p-3 flex flex-col items-center shadow-sm hover:shadow h-28"
      onClick={() => router.push(`/dashboard/owner/documents?doc=${doc.type}`)}
      style={{ minWidth: 0 }}
    >
      <i className={`${doc.icon} text-2xl text-blue-600 mb-1`} />
      {/* This span ensures neat two-line wrapping and truncation */}
      <span className="block text-center text-sm font-semibold text-gray-800 truncate w-full max-w-[72px] leading-snug whitespace-normal break-words">
        {doc.name}
      </span>
      <span className="text-xs text-gray-500">{doc.info}</span>
    </button>
  ))}
</div>

  <div className="text-xs text-gray-400 mt-2 font-medium">
    View/download leases, maintenance invoices, vendor quotes, and SARS-ready tax schedules.
  </div>
</div>

          {/* Quick Actions */}
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => router.push('/dashboard/owner/contracts')}
                className="bg-white rounded-lg border border-gray-100 p-3 flex flex-col items-center shadow-sm hover:shadow"
              >
                <i className="fas fa-file-signature text-2xl text-blue-600 mb-1" />
                <span className="text-xs font-semibold text-gray-800">Contracts</span>
              </button>
              <button
                onClick={() => router.push('/dashboard/owner/dedicated-vendors')}
                className="bg-white rounded-lg border border-gray-100 p-3 flex flex-col items-center shadow-sm hover:shadow"
              >
                <i className="fas fa-user-cog text-2xl text-indigo-600 mb-1" />
                <span className="text-xs font-semibold text-gray-800">My Vendors</span>
              </button>
              <button
                onClick={() => router.push('/dashboard/owner/maintenance')}
                className="bg-white rounded-lg border border-gray-100 p-3 flex flex-col items-center shadow-sm hover:shadow"
              >
                <i className="fas fa-tools text-2xl text-yellow-600 mb-1" />
                <span className="text-xs font-semibold text-gray-800">Maintenance</span>
              </button>
            </div>
          </div>

          {/* Maintenance Quick View */}
          <div className="mb-7">
            <div className="flex items-center mb-2 justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Active Maintenance</h3>
              <button
                onClick={() => router.push('/dashboard/owner/maintenance')}
                className="text-sm text-blue-700 font-semibold hover:text-blue-900"
              >
                See All
              </button>
            </div>
            <div className="space-y-2">
              {maintenance.length === 0 && (
                <div className="text-gray-500 text-base italic p-4">No active requests!</div>
              )}
              {maintenance.map((m) => (
                <div key={m.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 bg-${m.color || 'yellow-500'}/20 rounded-full flex items-center justify-center mr-2`}>
                      <i className="fas fa-tools text-yellow-500 text-lg"></i>
                    </div>
                    <div>
                      <div className="font-semibold text-base text-gray-800">{m.title}</div>
                      <div className="text-sm text-gray-500">{m.property_label || ''}</div>
                    </div>
                  </div>
                  <div className="ml-2 flex flex-col items-end">
                    {m.quote && (
                      <span className="text-sm text-blue-700 font-semibold">Quote: R {m.quote}</span>
                    )}
                    {m.invoice && (
                      <span className="text-sm text-emerald-700 font-semibold">Invoice: R {m.invoice}</span>
                    )}
                    <span className={`mt-0.5 text-xs rounded px-2 py-0.5 ${m.status === 'Open' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>{m.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rental Applications */}
<div className="mb-7">
  <div className="flex items-center mb-2 justify-between">
    <h3 className="text-lg font-semibold text-gray-900">Recent Applications</h3>
    <button
      onClick={() => router.push('/dashboard/owner/applications')}
      className="text-sm text-blue-700 font-semibold hover:text-blue-900"
    >
      See All
    </button>
  </div>
  <div className="space-y-2">
    {applicants.length === 0 ? (
      <div className="text-sm text-gray-500">No recent applications.</div>
    ) : (
      applicants.map((a, idx) => (
        <div key={idx} className="flex items-center bg-white p-2 rounded-lg shadow-sm border border-gray-100">
          <Image src={a.avatar} alt={a.name} width={36} height={36} className="rounded-full" />
          <div className="ml-3 flex-1">
            <div className="font-semibold text-base text-gray-900">{a.name}</div>
            <div className="text-sm text-gray-500">{a.property}</div>
          </div>
          <span className={`ml-2 text-xs rounded px-2 ${a.status === 'Approved'
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-yellow-100 text-yellow-800'
          }`}>{a.status}</span>
          <span className="text-xs text-gray-400 ml-2">{a.date}</span>
        </div>
      ))
    )}
  </div>
</div>


          {/* Recent Activity Feed */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-7">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <button className="text-sm text-blue-600 hover:text-blue-800 font-semibold">View All</button>
            </div>
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <div className="text-sm text-gray-500">No recent activity.</div>
              ) : (
                recentActivity.map((a, idx) => (
                  <div key={idx} className="flex items-center space-x-3">
                    <div className={`w-8 h-8 bg-${a.color}/10 rounded-full flex items-center justify-center`}>
                      <i className={`${a.icon} text-${a.color} text-xl`}></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-semibold text-gray-800">{a.label}</p>
                      <p className="text-sm text-gray-600">{a.value}</p>
                    </div>
                    <span className="text-xs text-gray-500">{a.date}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <BottomNavbar userRole="owner" />
      </div>
    </ProtectedRoute>
  )
}
