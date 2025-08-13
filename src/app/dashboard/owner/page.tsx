'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useState } from 'react'
import Image from 'next/image'
import BottomNavbar from '@/components/BottomNavbar'

export default function OwnerDashboardPage() {
  const router = useRouter()
  const { profile } = useAuthStore()

  // Example data for widgets
  const [portfolio] = useState({
    totalUnits: 10,
    occupied: 8,
    vacant: 2,
    monthIncome: 76000,
    arrears: 7000,
    occupancy: 80
  })
  const [analytics] = useState({
    ytdIncome: 430000,
    avgOccupancy: 86,
    late: 2,
    repairsOpen: 4
  })
  const [maintenance] = useState([
    { title: 'Geyser Burst', unit: 'Rosebank Lofts 5C', status: 'Open', vendor: 'FixItNow', quote: 2000, invoice: 2100, color: 'blue-500' },
    { title: 'Leakage', unit: 'Sandton Villas 3A', status: 'Quote received', vendor: 'WaterPros', quote: 1250, invoice: null, color: 'yellow-500' }
  ])
  const [documents] = useState([
    { name: 'Lease Contracts', icon: 'fas fa-file-signature', type: 'lease', count: 7, info: 'Active/Past' },
    { name: 'Invoices', icon: 'fas fa-file-invoice-dollar', type: 'invoice', count: 6, info: 'Latest' },
    { name: 'Vendor Quotes', icon: 'fas fa-file-contract', type: 'quote', count: 3, info: 'For Review' },
    { name: 'Tax Reports', icon: 'fas fa-balance-scale', type: 'tax', count: 2, info: 'Annual/CSV' },
    { name: 'Compliance Docs', icon: 'fas fa-shield-alt', type: 'compliance', count: 5, info: 'FICA, COC' }
  ])
  const [applicants] = useState([
    {
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
      name: 'Mpumi Ndlovu',
      property: 'Rosebank Lofts',
      status: 'Pending',
      date: '1h ago'
    },
    {
      avatar: 'https://randomuser.me/api/portraits/men/65.jpg',
      name: 'Malik Jacobs',
      property: 'Sandton View',
      status: 'Approved',
      date: '3h ago'
    },
    {
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
      name: 'Andile Mokoena',
      property: 'Umhlanga Heights',
      status: 'Pending',
      date: '4h ago'
    },
    {
      avatar: 'https://randomuser.me/api/portraits/women/54.jpg',
      name: 'Megan Louw',
      property: 'Central Park Villas',
      status: 'Approved',
      date: 'Today'
    }
  ])
  
  
  const [recentActivity] = useState([
    { icon: 'fas fa-file-invoice-dollar', color: 'emerald-600', label: 'Rent Received', value: 'R 12,000', date: 'Today' },
    { icon: 'fas fa-exclamation-triangle', color: 'red-500', label: 'Arrears Notice', value: 'Unit 207', date: '1h ago' },
    { icon: 'fas fa-tools', color: 'yellow-600', label: 'New Maintenance', value: 'Rosebank Lofts', date: 'Yesterday' }
  ])


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
          <div>
            <h1 className="text-xl font-bold text-gray-900">Portfolio Dashboard</h1>
            <p className="text-sm text-blue-700 font-medium">Welcome back, {profile?.full_name || 'Owner'}</p>
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
                  Units: <b>{portfolio.totalUnits}</b> | Occupied: <b>{portfolio.occupied}</b> | Vacant: <b>{portfolio.vacant}</b>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between my-2">
              <div>
                <div className="text-blue-200 text-sm font-medium">Monthly Rent</div>
                <div className="text-xl font-extrabold">R {portfolio.monthIncome.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-blue-200 text-sm font-medium">In Arrears</div>
                <div className="text-xl font-bold text-yellow-100">R {portfolio.arrears.toLocaleString()}</div>
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
                onClick={() => router.push('/contracts')}
                className="bg-white/90 text-blue-700 rounded-lg px-3 py-2 text-sm font-semibold shadow hover:bg-blue-50 transition"
              >
                Lease Contracts
              </button>
            </div>
          </div>

          {/* Key Analytics */}
          <div className="grid grid-cols-2 gap-4 mb-7">
  <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-4 flex flex-col items-center">
    <i className="fas fa-coins text-emerald-600 text-2xl mb-1" />
    <div className="font-extrabold text-xl text-gray-900">R {analytics.ytdIncome.toLocaleString()}</div>
    <div className="text-sm text-gray-700 font-semibold mt-1">YTD Income</div>
  </div>
  <div className="bg-white rounded-lg shadow-sm border border-emerald-100 p-4 flex flex-col items-center">
    <i className="fas fa-chart-line text-blue-500 text-2xl mb-1" />
    <div className="font-extrabold text-xl text-gray-900">{analytics.avgOccupancy}%</div>
    <div className="text-sm text-gray-700 font-semibold mt-1">Avg. Occupancy</div>
  </div>
  <div className="bg-white rounded-lg shadow-sm border border-yellow-100 p-4 flex flex-col items-center">
    <i className="fas fa-user-clock text-yellow-500 text-2xl mb-1" />
    <div className="font-extrabold text-xl text-gray-900">{analytics.late}</div>
    <div className="text-sm text-gray-700 font-semibold mt-1">Tenants In Arrears</div>
  </div>
  <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-4 flex flex-col items-center">
    <i className="fas fa-tools text-blue-600 text-2xl mb-1" />
    <div className="font-extrabold text-xl text-gray-900">{analytics.repairsOpen}</div>
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
              {maintenance.map((m, i) => (
                <div key={i} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 bg-${m.color}/20 rounded-full flex items-center justify-center mr-2`}>
                      <i className="fas fa-tools text-yellow-500 text-lg"></i>
                    </div>
                    <div>
                      <div className="font-semibold text-base text-gray-800">{m.title}</div>
                      <div className="text-sm text-gray-500">{m.unit}</div>
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
    {applicants.map((a, idx) => (
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
    ))}
  </div>
</div>


          {/* Recent Activity Feed */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-7">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <button className="text-sm text-blue-600 hover:text-blue-800 font-semibold">View All</button>
            </div>
            <div className="space-y-3">
              {recentActivity.map((a, idx) => (
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
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <BottomNavbar userRole="owner" />
      </div>
    </ProtectedRoute>
  )
}
