'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import ProtectedRoute from '@/components/ProtectedRoute'
import BottomNavbar from '@/components/BottomNavbar'
import Image from 'next/image'
import { useState } from 'react'

export default function TenantDashboardPage() {
  const router = useRouter()
  const { user, profile, signOut } = useAuthStore()
  const [currentRent] = useState(12500)
  const [nextPaymentDate] = useState('1 March 2024')
  const [activeMaintenance] = useState([
    {
      title: 'Kitchen Tap Repair',
      status: 'In Progress',
      detail: 'Leaking kitchen tap needs immediate attention',
      icon: 'fas fa-tools',
      color: 'orange-500',
      date: '3 days ago',
    },
    {
      title: 'Electrical Issue',
      status: 'Scheduled',
      detail: 'Bedroom light switch not working',
      icon: 'fas fa-bolt',
      color: 'blue-500',
      date: '1 day ago',
    }
  ])
  const [docs] = useState([
    { name: 'Lease Agreement', date: '15 Jan 2024', type: 'pdf', icon: 'fas fa-file-signature' },
    { name: 'Inventory Report', date: '10 Jan 2024', type: 'pdf', icon: 'fas fa-file-invoice' },
    { name: 'Payment Receipts', date: 'Today', type: 'pdf', icon: 'fas fa-receipt' }
  ])
  const [recentActivity] = useState([
    { type: 'payment', text: 'Payment Confirmed', amount: 'R 12,500', date: '2 days ago', icon: 'fas fa-check-circle', color: 'emerald-600' },
    { type: 'maintenance', text: 'Maintenance Request', detail: 'Kitchen tap repair', date: '3 days ago', icon: 'fas fa-tools', color: 'blue-600' }
  ])
  const [showSupport, setShowSupport] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  // Navigation handlers
  const NAV = {
    search: () => router.push('/properties/search'),
    payments: () => router.push('/tenant/payments'),
    maintenance: () => router.push('/tenant/maintenance'),
    applications: () => router.push('/tenant/applications'),
    docs: () => router.push('/tenant/documents'),
    chat: () => setShowSupport(true)
  }

  return (
    <ProtectedRoute allowedRoles={['tenant']}>
      <div className="max-w-md mx-auto min-h-screen shadow-xl bg-gradient-to-b from-green-50 to-white relative overflow-hidden pb-28">
        {/* Decorative background as per index.html */}
        <div className="absolute inset-0 opacity-5 pointer-events-none select-none">
          <div className="absolute top-20 left-12 w-16 h-16 border border-emerald-600 rounded-full"></div>
          <div className="absolute bottom-40 right-8 w-20 h-20 border border-yellow-500 rounded-full"></div>
          <div className="absolute top-1/3 right-6 w-12 h-12 border border-indigo-500 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="bg-white shadow-sm p-4 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center shadow">
                <i className="fas fa-user text-white text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800 mb-0">Welcome back, {profile?.full_name || 'Tenant'}!</h1>
                <p className="text-xs text-gray-400">Your current property:</p>
                <span className="text-sm text-emerald-700 font-medium">Sandton Apartment</span>
              </div>
            </div>
            <button className="p-2 relative rounded-full bg-gray-100 hover:bg-gray-200 transition-colors" title="Notifications">
              <i className="fas fa-bell text-gray-600"></i>
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-white">2</span>
              </div>
            </button>
          </div>
        </div>

        <div className="p-6 pb-2 relative z-10">

          {/* Current Property payment summary */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl p-6 text-white mb-6 shadow-lg">
            <div className="flex items-center mb-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden mr-4 flex-shrink-0">
                <Image
                  src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=300&h=200&fit=crop&crop=center"
                  alt="Sandton Apartment"
                  width={64} height={64}
                  className="w-16 h-16 object-cover rounded-lg"
                  unoptimized
                />
              </div>
              <div>
                <div className="text-base font-semibold">Sandton, Johannesburg</div>
                <div className="text-sm text-emerald-100">Lease till Dec 2024</div>
              </div>
            </div>
            <div className="grid grid-cols-2 items-center mb-3">
              <div>
                <div className="text-emerald-200 text-xs">Monthly Rent</div>
                <div className="text-2xl font-bold">R {currentRent.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-emerald-200 text-xs">Next Payment</div>
                <div className="text-lg font-semibold">{nextPaymentDate}</div>
              </div>
            </div>
            <div className="flex space-x-2 mt-3">
              <button
                onClick={NAV.payments}
                className="flex-1 bg-white text-emerald-700 font-semibold py-2 rounded-lg shadow hover:bg-emerald-50 transition-colors text-sm"
              >
                Pay Now
              </button>
              <button
                onClick={NAV.docs}
                className="flex-1 bg-white text-emerald-600 font-medium py-2 rounded-lg shadow hover:bg-emerald-50 transition-colors text-sm"
              >
                Download Receipt
              </button>
            </div>
          </div>

          {/* Maintenance Callout */}
          <div className="bg-orange-50 rounded-lg p-4 flex items-center justify-between mb-5 border border-orange-100 shadow-sm">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <i className="fas fa-tools text-orange-500"></i>
                <span className="font-semibold text-orange-800 text-sm">Maintenance</span>
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-orange-200 text-orange-800 font-bold">
                  {activeMaintenance.length} Active
                </span>
              </div>
              <div className="text-xs text-orange-700">
                {activeMaintenance[0].title}: {activeMaintenance[0].status}
              </div>
            </div>
            <button
              onClick={NAV.maintenance}
              className="ml-4 px-3 py-2 rounded-md font-semibold bg-orange-500 text-white text-xs shadow hover:bg-orange-600 transition"
            >
              View All
            </button>
          </div>

          {/* Verification Status */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <i className="fas fa-shield-alt text-emerald-600"></i>
                <h3 className="font-semibold text-gray-800 text-sm">Account Status</h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${profile?.verification_status ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>
                {profile?.verification_status ? 'Verified' : 'Under Review'}
              </span>
            </div>
            <p className="text-xs text-gray-600">
              {profile?.verification_status ?
                'Your account is verified and ready to apply for properties.' :
                'We are reviewing your FICA documents. This typically takes 1-2 business days.'}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-3 mb-8">
            {/* Each quick action: */}
            <button onClick={NAV.search} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center hover:border-emerald-200 transition-all group">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mb-1 group-hover:bg-emerald-200 transition-colors">
                <i className="fas fa-search text-emerald-600 text-lg"></i>
              </div>
              <span className="text-xs text-gray-700">Browse</span>
            </button>
            <button onClick={NAV.maintenance} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center hover:border-orange-200 transition-all group">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mb-1 group-hover:bg-orange-200 transition-colors">
                <i className="fas fa-tools text-orange-600 text-lg"></i>
              </div>
              <span className="text-xs text-gray-700">Maintenance</span>
            </button>
            <button onClick={NAV.docs} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center hover:border-blue-200 transition-all group">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-1 group-hover:bg-blue-200 transition-colors">
                <i className="fas fa-file-alt text-blue-600 text-lg"></i>
              </div>
              <span className="text-xs text-gray-700">Documents</span>
            </button>
            <button onClick={NAV.applications} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center hover:border-purple-200 transition-all group">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mb-1 group-hover:bg-purple-200 transition-colors">
                <i className="fas fa-file-signature text-purple-600 text-lg"></i>
              </div>
              <span className="text-xs text-gray-700">Applications</span>
            </button>
          </div>

          {/* Active Maintenance Requests */}
          <div className="mb-7">
            <div className="flex items-center mb-2 justify-between">
              <h3 className="text-base font-semibold text-gray-800">
                Active Maintenance
              </h3>
              <button
                onClick={NAV.maintenance}
                className="text-xs text-emerald-700 font-medium hover:text-emerald-900"
              >
                See All
              </button>
            </div>
            {activeMaintenance.length === 0 ? (
              <div className="text-gray-500 text-xs italic p-4">No active requests!</div>
            ) : (
              <div className="space-y-2">
                {activeMaintenance.map((item, idx) => (
                  <div key={idx} className="flex items-start bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-${item.color}/20 mr-2 mt-0.5`}>
                      <i className={`${item.icon} text-${item.color} text-base`}></i>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm text-gray-800">{item.title}</span>
                        <span className={`ml-1 text-xs rounded px-2 py-0.5 ${item.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>{item.status}</span>
                      </div>
                      <div className="text-xs text-gray-500">{item.detail}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{item.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => router.push('/tenant/maintenance/new')}
              className="w-full text-emerald-700 border border-emerald-600 rounded-lg py-2 mt-2 font-semibold bg-emerald-50 shadow-sm hover:bg-emerald-100 flex items-center justify-center space-x-2 text-sm"
            >
              <i className="fas fa-plus"></i>
              <span>New Maintenance Request</span>
            </button>
          </div>

          {/* Documents Center */}
          <div className="mb-6">
            <div className="flex items-center mb-2 justify-between">
              <h3 className="text-base font-semibold text-gray-800">
                My Documents
              </h3>
              <button
                onClick={NAV.docs}
                className="text-xs text-blue-700 font-medium hover:text-blue-900"
              >
                See All
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {docs.map((doc, idx) => (
                <button
                  key={doc.name}
                  className="bg-white rounded-lg border border-gray-100 p-3 flex flex-col items-center shadow-sm hover:shadow"
                  onClick={() => router.push(`/tenant/documents?doc=${doc.name}`)}
                >
                  <i className={`${doc.icon} text-xl text-emerald-600 mb-1`}></i>
                  <span className="text-xs font-medium text-gray-700 truncate">{doc.name}</span>
                  <span className="text-[10px] text-gray-400">{doc.date}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">Recent Activity</h3>
              <button className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                View All
              </button>
            </div>
            <div className="space-y-3">
              {recentActivity.map((a, idx) => (
                <div key={idx} className="flex items-center space-x-3">
                  <div className={`w-8 h-8 bg-${a.color}/10 rounded-full flex items-center justify-center`}>
                    <i className={`${a.icon} text-${a.color} text-base`}></i>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{a.text}</p>
                    {a.amount &&
                      <p className="text-xs text-gray-500">{a.amount} {a.detail ? '• ' + a.detail : ''}</p>
                    }
                  </div>
                  <span className="text-xs text-gray-400">{a.date}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Support/Contact */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-100 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Need Help?</h3>
                <p className="text-sm text-gray-600">Our support team is here 24/7</p>
              </div>
              <button
                className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                onClick={NAV.chat}
              >
                Contact Us
              </button>
            </div>
            {/* Example support bubble or modal trigger could go here */}
          </div>

          {/* Move sign out to Profile in bottom nav for better UX */}
        </div>

        {/* Bottom Navigation */}
        <BottomNavbar userRole="tenant" />

        {/* Example: Conditional support chat modal */}
        {showSupport && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-lg max-w-xs w-full p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-emerald-700">Support Chat</h3>
                <button onClick={() => setShowSupport(false)} className="text-gray-400 hover:text-gray-700">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="text-xs text-gray-500 mb-2">Chat with your property manager or support team below:</div>
              {/* Placeholder for Chat UI */}
              <div className="bg-gray-100 rounded p-2 text-xs text-gray-600 mb-2">
                [Chat window goes here...]
              </div>
              <button onClick={() => setShowSupport(false)} className="w-full mt-2 bg-emerald-600 text-white py-2 rounded-lg font-semibold">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
