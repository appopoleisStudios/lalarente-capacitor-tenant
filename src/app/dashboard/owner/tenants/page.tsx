'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import ProtectedRoute from '@/components/ProtectedRoute'
import BottomNavbar from '@/components/BottomNavbar'
import { ArrowLeft, Users, UserPlus, Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Tenant {
  id: string
  full_name: string
  email: string
  phone: string | null
  verification_status: boolean
  property: {
    id: string
    title: string
    address: string
  } | null
  lease: {
    id: string
    lease_start: string
    lease_end: string
    rent_amount: number
    status: string | null
  } | null
  last_payment: {
    amount: number
    paid_date: string | null
    status: string | null
  } | null
}

export default function OwnerTenantsPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'overdue' | 'verified'>('all')

  useEffect(() => {
    if (!user) return
    loadTenants()
  }, [user])

  const loadTenants = async () => {
    try {
      setLoading(true)
      
      // Get owner's properties
      const { data: properties } = await supabase
        .from('properties')
        .select('id, title, address')
        .eq('owner_id', user?.id || '')

      if (!properties || properties.length === 0) {
        setTenants([])
        return
      }

      const propertyIds = properties.map(p => p.id)

      // Get active leases with tenant and property info
      const { data: leases } = await supabase
        .from('leases')
        .select(`
          id,
          tenant_id,
          property_id,
          lease_start,
          lease_end,
          rent_amount,
          status,
          tenant:profiles!leases_tenant_id_fkey(
            id,
            full_name,
            email,
            phone,
            verification_status
          ),
          property:properties!leases_property_id_fkey(
            id,
            title,
            address
          )
        `)
        .in('property_id', propertyIds)
        .eq('status', 'active')

      // Get recent payments for each tenant
      const tenantIds = leases?.map(l => l.tenant_id) || []
      const { data: payments } = await supabase
        .from('payments')
        .select('tenant_id, amount, paid_date, status')
        .in('tenant_id', tenantIds)
        .order('paid_date', { ascending: false })

      // Process and combine data
      const tenantsData: Tenant[] = (leases || []).map(lease => {
        const tenantPayments = payments?.filter(p => p.tenant_id === lease.tenant_id) || []
        const lastPayment = tenantPayments[0] || null

        return {
          id: lease.tenant?.id || '',
          full_name: lease.tenant?.full_name || 'Unknown',
          email: lease.tenant?.email || '',
          phone: lease.tenant?.phone || null,
          verification_status: lease.tenant?.verification_status || false,
          property: lease.property || null,
          lease: {
            id: lease.id,
            lease_start: lease.lease_start,
            lease_end: lease.lease_end,
            rent_amount: lease.rent_amount,
            status: lease.status
          },
          last_payment: lastPayment ? {
            amount: lastPayment.amount,
            paid_date: lastPayment.paid_date,
            status: lastPayment.status
          } : null
        }
      })

      setTenants(tenantsData)
    } catch (error) {
      console.error('Error loading tenants:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tenant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tenant.property?.title.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (filterStatus === 'all') return matchesSearch
    if (filterStatus === 'verified') return matchesSearch && tenant.verification_status
    if (filterStatus === 'active') return matchesSearch && tenant.lease?.status === 'active'
    if (filterStatus === 'overdue') {
      if (!tenant.last_payment || !tenant.last_payment.paid_date) return matchesSearch
      const lastPaymentDate = new Date(tenant.last_payment.paid_date)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return matchesSearch && lastPaymentDate < thirtyDaysAgo
    }
    
    return matchesSearch
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getPaymentStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800'
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'overdue': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div className="max-w-sm mx-auto min-h-screen bg-white pb-24">
        {/* Header */}
        <div className="px-4 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="font-semibold text-gray-900">My Tenants</h1>
              <p className="text-sm text-blue-700">Manage tenant relationships</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard/owner/tenants/invite')}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Invite
          </button>
        </div>

        {/* Search and Filter */}
        <div className="px-4 py-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tenants, properties..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Tenants</option>
              <option value="active">Active</option>
              <option value="verified">Verified</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="px-4 py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Loading tenants...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredTenants.length === 0 && (
          <div className="px-4 py-8 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tenants found</h3>
            <p className="text-sm text-gray-600 mb-4">
              {searchTerm || filterStatus !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'You don\'t have any active tenants yet.'
              }
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button
                onClick={() => router.push('/dashboard/owner/tenants/invite')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Invite Your First Tenant
              </button>
            )}
          </div>
        )}

        {/* Tenants List */}
        {!loading && filteredTenants.length > 0 && (
          <div className="px-4 pb-4 space-y-3">
            {filteredTenants.map((tenant) => (
              <div key={tenant.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{tenant.full_name}</h3>
                      {tenant.verification_status && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{tenant.email}</p>
                    {tenant.phone && (
                      <p className="text-sm text-gray-600">{tenant.phone}</p>
                    )}
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/owner/tenants/${tenant.id}`)}
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View Details
                  </button>
                </div>

                {tenant.property && (
                  <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">{tenant.property.title}</p>
                    <p className="text-xs text-gray-600">{tenant.property.address}</p>
                  </div>
                )}

                {tenant.lease && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Lease Period:</span>
                      <p className="font-medium text-gray-900">
                        {formatDate(tenant.lease.lease_start)} - {formatDate(tenant.lease.lease_end)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Monthly Rent:</span>
                      <p className="font-medium text-gray-900">{formatCurrency(tenant.lease.rent_amount)}</p>
                    </div>
                  </div>
                )}

                {tenant.last_payment && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-500">Last Payment:</span>
                        <p className="font-medium text-gray-900">{formatCurrency(tenant.last_payment.amount)}</p>
                        <p className="text-xs text-gray-600">{formatDate(tenant.last_payment.paid_date)}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(tenant.last_payment.status)}`}>
                        {(tenant.last_payment.status ?? 'unknown').charAt(0).toUpperCase() + (tenant.last_payment.status ?? 'unknown').slice(1)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <BottomNavbar userRole="owner" />
      </div>
    </ProtectedRoute>
  )
}
