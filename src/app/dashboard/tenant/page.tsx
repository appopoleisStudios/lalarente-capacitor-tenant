'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
// import Image from 'next/image'
import { useAuthStore } from '@/store/authStore'
import ProtectedRoute from '@/components/ProtectedRoute'
import BottomNavbar from '@/components/BottomNavbar'
import TenantHeader from '@/components/Dashboard/Tenant/TenantHeader'
import PropertySummaryCard from '@/components/Dashboard/Tenant/PropertySummaryCard'
import AutoPayToggle from '@/components/Dashboard/Tenant/AutoPayToggle'
import QuickActionsGrid from '@/components/Dashboard/Tenant/QuickActionsGrid'
import ActiveMaintenanceList from '@/components/Dashboard/Tenant/ActiveMaintenanceList'
import VerificationStatus from '@/components/Dashboard/Tenant/VerificationStatus'
import DocumentsCenter from '@/components/Dashboard/Tenant/DocumentsCenter'
import RecentActivityFeed from '@/components/Dashboard/Tenant/RecentActivityFeed'
import SupportContactCard from '@/components/Dashboard/Tenant/SupportContactCard'
import TenantChatWidget from '@/components/Dashboard/Tenant/TenantChatWidget'
import { createDocument } from '@/utils/documentUtils'





export default function TenantDashboardPage() {
  const router = useRouter()
  const { profile } = useAuthStore()
  // const [currentRent] = useState(12500)
  // const [nextPaymentDate] = useState('1 March 2024')
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
    createDocument('Lease Agreement', 'Active', 'fas fa-file-signature', { type: 'pdf' }),
    createDocument('Inventory Report', '10 Jan 2024', 'fas fa-file-invoice', { type: 'pdf' }),
    createDocument('Payment Receipts', 'Today', 'fas fa-receipt', { type: 'pdf' })
  ])
  const [recentActivity] = useState([
    { type: 'payment', text: 'Payment Confirmed', amount: 'R 12,500', date: '2 days ago', icon: 'fas fa-check-circle', color: 'emerald-600' },
    { type: 'maintenance', text: 'Maintenance Request', detail: 'Kitchen tap repair', date: '3 days ago', icon: 'fas fa-tools', color: 'blue-600' }
  ])
  const [showSupport, setShowSupport] = useState(false)

  // const handleSignOut = async () => {
  //   await signOut()
  //   router.push('/')
  // }

  // Navigation handlers
  // const NAV = {
  //   search: () => router.push('/properties/search'),
  //   payments: () => router.push('/tenant/payments'),
  //   maintenance: () => router.push('/tenant/maintenance'),
  //   applications: () => router.push('/tenant/applications'),
  //   docs: () => router.push('/tenant/documents'),
  //   chat: () => setShowSupport(true)
  // }

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
        <TenantHeader tenantName={profile?.full_name || 'Tenant'} propertyName="Sandton Apartment" />

        <div className="p-6 pb-2 relative z-10">

          {/* Current Property payment summary */}
          <PropertySummaryCard 
            propertyImg="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=300&h=200&fit=crop&crop=center"
            propertyName="Sandton, Johannesburg"
            leaseEnd="Dec 2024"
            rent={12500}
            nextPaymentDate="1 March 2024"
            onPayNow={() => router.push('/tenant/payments')}
            onReceipt={() => router.push('/tenant/documents?doc=Payment Receipts')}
          />
          {/* Auto-Pay Toggle */}
          <AutoPayToggle enabled={true} onToggle={() => {}} />

          {/* Quick Actions Grid */}
          <QuickActionsGrid onNavigate={router.push} />

          {/* Active Maintenance List */}
          <ActiveMaintenanceList activeRequests={activeMaintenance} onSeeAll={() => router.push('/tenant/maintenance')} />

          {/* Verification Status */}
          <VerificationStatus verified={profile?.verification_status || false} />

          {/* Documents Center */}
          <DocumentsCenter 
            docs={docs} 
            onOpen={(name) => {
              if (name.toLowerCase().includes('lease')) {
                // Tenant has at most one active or pending agreement; open list filtered for tenancy
                router.push('/dashboard/tenant/contracts')
              } else {
                router.push('/tenant/documents')
              }
            }} 
            onSeeAll={() => router.push('/tenant/documents')} 
          />

          {/* Recent Activity */}
          <RecentActivityFeed recentActivity={recentActivity} onSeeAll={() => router.push('/tenant/activity')} />

          {/* Support Contact Card */}
          <SupportContactCard onChat={() => setShowSupport(true)} />
        </div>

        {/* Chat bubble widget, always available */}
        <TenantChatWidget />

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
