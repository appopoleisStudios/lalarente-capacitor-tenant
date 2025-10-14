'use client'

import React, { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import VendorHeader from '@/components/Vendor/VendorHeader'
import BottomNavbar from '@/components/BottomNavbar'
import { Search, Calendar, DollarSign, Clock, Star, FileText, Eye } from 'lucide-react'

type ContractStatus = 'draft' | 'pending_signatures' | 'active' | 'completed' | 'terminated' | 'expired'

type ContractType = 'maintenance' | 'retainer' | 'project' | 'emergency'

type ContractPriority = 'low' | 'medium' | 'high' | 'urgent'

type SortField = 'created_at' | 'contract_value' | 'renewal_date' | 'priority'

interface VendorContract {
  id: string
  title: string
  status: ContractStatus
  contract_type: ContractType
  priority: ContractPriority
  contract_value: number | null
  sla_hours: number | null
  renewal_date: string | null
  start_date: string | null
  end_date: string | null
  completion_date: string | null
  vendor_rating: number | null
  owner_rating: number | null
  vendor_notes: string | null
  owner_notes: string | null
  created_at: string
  updated_at: string
  property: {
    id: string
    title: string
    address: string
    city: string
  } | null
  owner: {
    id: string
    full_name: string
    email: string
  } | null
  tenant: {
    id: string
    full_name: string
    email: string
  } | null
  documents_count: number
  notifications_count: number
}

export default function VendorContractsPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [contracts, setContracts] = useState<VendorContract[]>([])
  const [filteredContracts, setFilteredContracts] = useState<VendorContract[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<ContractType | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<ContractPriority | 'all'>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'contract_value' | 'renewal_date' | 'priority'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const isSortField = (val: string): val is SortField => {
    return val === 'created_at' || val === 'contract_value' || val === 'renewal_date' || val === 'priority'
  }

  const loadContracts = React.useCallback(async () => {
    try {
      setLoading(true)
      
      // Load contracts with related data
      // Get contracts with related data in a single query to avoid RLS issues
      const { data: contractsData, error: contractsError } = await supabase
        .from('service_contracts')
        .select(`
          *,
          property:properties(id, title, address, city),
          owner:profiles!service_contracts_owner_id_fkey(id, full_name, email),
          tenant:profiles!service_contracts_tenant_id_fkey(id, full_name, email)
        `)
        .eq('vendor_id', user?.id as string)
        .order('created_at', { ascending: false })

      if (contractsError) throw contractsError

      console.log('Contracts with joins:', contractsData)

      console.log('Raw contracts data:', contractsData)
      console.log('First contract details:', contractsData?.[0])
      console.log('Owner data in first contract:', contractsData?.[0]?.owner)

      // Load document counts
      const { data: docCounts, error: docError } = await (supabase as any)
        .from('contract_documents')
        .select('contract_id')
        .in('contract_id', contractsData?.map(c => c.id) || [])

      if (docError) throw docError

      // Load notification counts
      const { data: notifCounts, error: notifError } = await (supabase as any)
        .from('contract_notifications')
        .select('contract_id')
        .eq('recipient_id', user?.id as string)
        .eq('is_read', false)
        .in('contract_id', contractsData?.map(c => c.id) || [])

      if (notifError) throw notifError

      // Create document and notification count maps (use plain objects to avoid TSX generic parsing issues)
      interface CountRow { contract_id: string }
      const docCountMap: Record<string, number> = {}
      ;(docCounts || []).forEach((doc: CountRow) => {
        const key = String(doc.contract_id)
        docCountMap[key] = (docCountMap[key] || 0) + 1
      })

      const notifCountMap: Record<string, number> = {}
      ;(notifCounts || []).forEach((notif: CountRow) => {
        const key = String(notif.contract_id)
        notifCountMap[key] = (notifCountMap[key] || 0) + 1
      })

             // Combine data
       const enrichedContracts: VendorContract[] = (contractsData || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        contract_type: c.contract_type,
        priority: c.priority,
        contract_value: c.contract_value ?? null,
        sla_hours: c.sla_hours ?? null,
        renewal_date: c.renewal_date || null,
        start_date: c.start_date || null,
        end_date: c.end_date || null,
        completion_date: c.completion_date || null,
        vendor_rating: c.vendor_rating ?? null,
        owner_rating: c.owner_rating ?? null,
        vendor_notes: c.vendor_notes || null,
        owner_notes: c.owner_notes || null,
        created_at: c.created_at,
        updated_at: c.updated_at,
        property: c.property || null,
        owner: c.owner || null,
        tenant: c.tenant || null,
        documents_count: docCountMap[String(c.id)] ?? 0,
        notifications_count: notifCountMap[String(c.id)] ?? 0
      }))

      setContracts(enrichedContracts)
    } catch (error) {
      console.error('Error loading contracts:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  const filterAndSortContracts = React.useCallback(() => {
    let filtered = [...contracts]

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(contract =>
        contract.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.property?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.owner?.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(contract => contract.status === statusFilter)
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(contract => contract.contract_type === typeFilter)
    }

    // Apply priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(contract => contract.priority === priorityFilter)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: number | string
      let bValue: number | string

      switch (sortBy) {
        case 'contract_value':
          aValue = a.contract_value || 0
          bValue = b.contract_value || 0
          break
        case 'renewal_date':
          aValue = a.renewal_date || '9999-12-31'
          bValue = b.renewal_date || '9999-12-31'
          break
        case 'priority':
          const priorityOrder = { low: 1, medium: 2, high: 3, urgent: 4 }
          aValue = priorityOrder[a.priority] || 1
          bValue = priorityOrder[b.priority] || 1
          break
        default:
          aValue = a.created_at
          bValue = b.created_at
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    setFilteredContracts(filtered)
  }, [contracts, searchTerm, statusFilter, typeFilter, priorityFilter, sortBy, sortOrder])

  // useEffect hooks after function definitions
  useEffect(() => {
    if (!user) return
    loadContracts()
  }, [user, loadContracts])

  useEffect(() => {
    filterAndSortContracts()
  }, [filterAndSortContracts])

  const getStatusColor = (status: ContractStatus) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'pending_signatures': return 'bg-yellow-100 text-yellow-800'
      case 'active': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'terminated': return 'bg-red-100 text-red-800'
      case 'expired': return 'bg-gray-100 text-gray-600'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: ContractPriority) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-600'
      case 'medium': return 'bg-blue-100 text-blue-600'
      case 'high': return 'bg-orange-100 text-orange-600'
      case 'urgent': return 'bg-red-100 text-red-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const getTypeColor = (type: ContractType) => {
    switch (type) {
      case 'maintenance': return 'bg-green-100 text-green-600'
      case 'retainer': return 'bg-purple-100 text-purple-600'
      case 'project': return 'bg-blue-100 text-blue-600'
      case 'emergency': return 'bg-red-100 text-red-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'Not specified'
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString('en-ZA')
  }

  const getDaysUntilRenewal = (renewalDate: string | null) => {
    if (!renewalDate) return null
    const today = new Date()
    const renewal = new Date(renewalDate)
    const diffTime = renewal.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  return (
    <ProtectedRoute allowedRoles={['vendor']}>
      <div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden">
        <VendorHeader />
        
        <main className="px-4 py-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">My Contracts</h1>
            <button
              onClick={() => router.push('/dashboard/vendor/jobs')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              View Jobs
            </button>
          </div>

          {/* Search and Filters */}
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search contracts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-600"
              />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ContractStatus | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending_signatures">Pending Signatures</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="terminated">Terminated</option>
                <option value="expired">Expired</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as ContractType | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="all">All Types</option>
                <option value="maintenance">Maintenance</option>
                <option value="retainer">Retainer</option>
                <option value="project">Project</option>
                <option value="emergency">Emergency</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as ContractPriority | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>

              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-')
          if (field && isSortField(field)) {
                    setSortBy(field)
                  } else {
                    setSortBy('created_at')
                  }
                  setSortOrder(order as 'asc' | 'desc')
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="created_at-desc">Newest First</option>
                <option value="created_at-asc">Oldest First</option>
                <option value="contract_value-desc">Highest Value</option>
                <option value="contract_value-asc">Lowest Value</option>
                <option value="renewal_date-asc">Renewal Date</option>
                <option value="priority-desc">Priority</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div className="text-sm text-gray-600">
            Showing {filteredContracts.length} of {contracts.length} contracts
          </div>

          {/* Contracts List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No contracts found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || priorityFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first contract'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredContracts.map((contract) => {
                const daysUntilRenewal = getDaysUntilRenewal(contract.renewal_date)
                const isRenewalSoon = daysUntilRenewal !== null && daysUntilRenewal <= 30 && daysUntilRenewal >= 0

                return (
                  <div
                    key={contract.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/dashboard/vendor/contracts/view?id=${contract.id}`)}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{contract.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <span>{contract.property?.title || 'No property'}</span>
                          <span>•</span>
                          <span>{contract.owner?.full_name || 'Unknown owner'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {contract.notifications_count > 0 && (
                          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                            {contract.notifications_count}
                          </span>
                        )}
                        <Eye className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>

                    {/* Status and Type Badges */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}>
                        {contract.status.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(contract.contract_type)}`}>
                        {contract.contract_type}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(contract.priority)}`}>
                        {contract.priority}
                      </span>
                    </div>

                    {/* Contract Details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-700">Value:</span>
                        <span className={`font-medium ${contract.contract_value ? 'text-gray-900' : 'text-gray-700'}`}>
                          {formatCurrency(contract.contract_value)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-700">SLA:</span>
                        <span className="font-medium">{contract.sla_hours || 'Not set'}h</span>
                      </div>

                      {contract.renewal_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-700">Renewal:</span>
                          <span className={`font-medium ${isRenewalSoon ? 'text-red-600' : 'text-gray-900'}`}>
                            {formatDate(contract.renewal_date)}
                            {isRenewalSoon && ` (${daysUntilRenewal} days)`}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-700">Rating:</span>
                        <span className={`font-medium ${contract.vendor_rating ? 'text-gray-900' : 'text-gray-700'}`}>
                          {contract.vendor_rating ? `${contract.vendor_rating}/5` : 'Not rated'}
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span>Created: {formatDate(contract.created_at)}</span>
                        {contract.documents_count > 0 && (
                          <span>{contract.documents_count} documents</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>

        <BottomNavbar userRole="vendor" />
      </div>
    </ProtectedRoute>
  )
}
