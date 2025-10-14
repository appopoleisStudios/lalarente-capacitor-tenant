'use client'

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Search, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
// Removed unused Link import
import BottomNavbar from '@/components/BottomNavbar'

type ContractType = 'maintenance' | 'cleaning' | 'security' | 'tenancy'
type SortField = 'title' | 'status' | 'priority' | 'value' | 'date'

interface OwnerContract {
  id: string
  title: string
  status: string
  contract_type: ContractType
  contract_table: 'service_contracts' | 'tenancy_contracts'
  contract_value: number | null
  start_date: string | null
  end_date: string | null
  renewal_date: string | null
  completion_date: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  sla_hours: number | null
  vendor_notes: string | null
  owner_notes: string | null
  documents_count: number
  notifications_count: number
  property: {
    id: string
    title: string
    address: string
    city: string
    province: string
  } | null
  vendor: {
    id: string
    full_name: string
    email: string | null
  } | null
  tenant: {
    id: string
    full_name: string
    email: string | null
  } | null
}

function OwnerContractsPageInner() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [contracts, setContracts] = useState<OwnerContract[]>([])
  const [filteredContracts, setFilteredContracts] = useState<OwnerContract[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sortBy, setSortBy] = useState('title')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showCreateTenancy, setShowCreateTenancy] = useState(false)
  const [msg, setMsg] = useState('')

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'pending_signatures', label: 'Pending Signatures' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'terminated', label: 'Terminated' },
    { value: 'expired', label: 'Expired' }
  ]

  const typeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'cleaning', label: 'Cleaning' },
    { value: 'security', label: 'Security' },
    { value: 'tenancy', label: 'Tenancy' }
  ]

  const priorityOptions = [
    { value: 'all', label: 'All Priorities' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' }
  ]

  const sortOptions = [
    { value: 'title', label: 'Title' },
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'value', label: 'Value' },
    { value: 'date', label: 'Date' }
  ]

  const [formData, setFormData] = useState({
    property_id: '',
    tenant_id: '',
    title: '',
    description: '',
    monthly_rent: '',
    security_deposit: '',
    lease_start_date: '',
    lease_end_date: ''
  })

  const handleCreateTenancy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return

    try {
      const { error } = await supabase
        .from('tenancy_contracts')
        .insert({
          owner_id: user.id,
          property_id: formData.property_id,
          tenant_id: formData.tenant_id,
          title: formData.title,
          description: formData.description,
          monthly_rent: parseFloat(formData.monthly_rent),
          security_deposit: parseFloat(formData.security_deposit),
          lease_start_date: formData.lease_start_date,
          lease_end_date: formData.lease_end_date,
          status: 'draft'
        })

      if (error) {
        console.error('Error creating tenancy contract:', error)
        setMsg('Error creating tenancy contract')
        return
      }

      setMsg('Tenancy contract created successfully')
      setShowCreateTenancy(false)
      setFormData({
        property_id: '',
        tenant_id: '',
        title: '',
        description: '',
        monthly_rent: '',
        security_deposit: '',
        lease_start_date: '',
        lease_end_date: ''
      })
      loadContracts()
    } catch (error) {
      console.error('Error creating tenancy contract:', error)
      setMsg('Error creating tenancy contract')
    }
  }

  const isSortField = (val: string): val is SortField => {
    return val === 'title' || val === 'status' || val === 'priority' || val === 'value' || val === 'date'
  }

  const loadContracts = async () => {
    try {
      setLoading(true)

      // Load service contracts
      const { data: serviceContracts, error: serviceError } = await supabase
        .from('service_contracts')
        .select(`
          id,
          title,
          status,
          contract_type,
          contract_value,
          start_date,
          end_date,
          renewal_date,
          completion_date,
          priority,
          sla_hours,
          vendor_notes,
          owner_notes,
          property:properties(id, title, address, city, province),
          vendor:profiles!service_contracts_vendor_id_fkey(id, full_name, email),
          tenant:profiles!service_contracts_tenant_id_fkey(id, full_name, email)
        `)
        .eq('owner_id', user!.id as string)
        .order('created_at', { ascending: false })

      if (serviceError) {
        console.error('Error loading service contracts:', serviceError)
      }

      // Load tenancy contracts
      const { data: tenancyContracts, error: tenancyError } = await supabase
        .from('tenancy_contracts')
        .select(`
          id,
          title,
          status,
          property:properties(id, title, address, city, province),
          tenant:profiles!tenancy_contracts_tenant_id_fkey(id, full_name, email)
        `)
        .eq('owner_id', user!.id as string)
        .order('created_at', { ascending: false })

      if (tenancyError) {
        console.error('Error loading tenancy contracts:', tenancyError)
      }

      // Transform service contracts
      const transformedServiceContracts: OwnerContract[] = (serviceContracts || []).map((contract: any) => ({
        id: contract.id,
        title: contract.title,
        status: contract.status,
        contract_type: contract.contract_type as ContractType,
        contract_table: 'service_contracts' as const,
        contract_value: contract.contract_value,
        start_date: contract.start_date,
        end_date: contract.end_date,
        renewal_date: contract.renewal_date,
        completion_date: contract.completion_date,
        priority: contract.priority as 'low' | 'medium' | 'high' | 'urgent',
        sla_hours: contract.sla_hours,
        vendor_notes: contract.vendor_notes,
        owner_notes: contract.owner_notes,
        documents_count: 0, // TODO: Implement when contract_documents table is properly accessible
        notifications_count: 0, // TODO: Implement when contract_notifications table is properly accessible
        property: contract.property as any,
        vendor: contract.vendor,
        tenant: contract.tenant
      }))

      // Transform tenancy contracts
      const transformedTenancyContracts: OwnerContract[] = (tenancyContracts || []).map((contract: any) => ({
        id: contract.id,
        title: contract.title,
        status: contract.status,
        contract_type: 'tenancy' as ContractType,
        contract_table: 'tenancy_contracts' as const,
        contract_value: null,
        start_date: null,
        end_date: null,
        renewal_date: null,
        completion_date: null,
        priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
        sla_hours: null,
        vendor_notes: null,
        owner_notes: null,
        documents_count: 0, // TODO: Implement when contract_documents table is properly accessible
        notifications_count: 0, // TODO: Implement when contract_notifications table is properly accessible
        property: contract.property as any,
        vendor: null,
        tenant: contract.tenant
      }))

      // Combine and set contracts
      const allContracts = [...transformedServiceContracts, ...transformedTenancyContracts]
      setContracts(allContracts)
    } catch (error) {
      console.error('Error loading contracts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) {
      loadContracts()
    }
  }, [user?.id])

  const filterAndSortContracts = React.useCallback(() => {
    let filtered = contracts

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(contract =>
        contract.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.property?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contract.vendor?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contract.tenant?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
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
      let aValue: any
      let bValue: any

      switch (sortBy) {
        case 'title':
          aValue = a.title
          bValue = b.title
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        case 'priority':
          aValue = a.priority
          bValue = b.priority
          break
        case 'value':
          aValue = a.contract_value || 0
          bValue = b.contract_value || 0
          break
        case 'date':
          aValue = new Date(a.start_date || 0)
          bValue = new Date(b.start_date || 0)
          break
        default:
          aValue = a.title
          bValue = b.title
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    setFilteredContracts(filtered)
  }, [contracts, searchTerm, statusFilter, typeFilter, priorityFilter, sortBy, sortOrder])

  useEffect(() => {
    filterAndSortContracts()
  }, [filterAndSortContracts])

  // Update preview when template or title changes
  useEffect(() => {
    // This effect is no longer needed as templates and ownerProperties are removed.
    // Keeping it for now as it might be re-introduced or removed later.
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'pending_signatures': return 'bg-yellow-100 text-yellow-800'
      case 'active': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'terminated': return 'bg-red-100 text-red-800'
      case 'expired': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-800'
      case 'medium': return 'bg-blue-100 text-blue-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'urgent': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: ContractType) => {
    switch (type) {
      case 'maintenance': return 'bg-green-100 text-green-600'
      case 'cleaning': return 'bg-purple-100 text-purple-600'
      case 'security': return 'bg-blue-100 text-blue-600'
      case 'tenancy': return 'bg-indigo-100 text-indigo-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const getDaysUntilRenewal = (renewalDate: string | null): number | null => {
    if (!renewalDate) return null
    const renewal = new Date(renewalDate)
    const today = new Date()
    const diffTime = renewal.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const formatCurrency = (amount: number | null): string => {
    if (!amount) return 'Not set'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900">My Contracts</h1>
      </div>
      
      <main className="px-4 py-4 space-y-4">
        {msg && (
          <div className="mb-4 p-3 rounded border border-gray-200 bg-gray-50 text-gray-700">{msg}</div>
        )}

        {/* Header with Create Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Contract Management</h2>
            <p className="text-sm text-gray-600">Manage your service and tenancy contracts</p>
          </div>
          <button
            onClick={() => setShowCreateTenancy(!showCreateTenancy)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Tenancy
          </button>
        </div>

        {/* Create Tenancy Form */}
        {showCreateTenancy && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-semibold mb-3">Create New Tenancy Contract</h3>
            <form onSubmit={handleCreateTenancy} className="space-y-3">
              <input 
                className="w-full border rounded px-3 py-2 text-gray-900 placeholder-gray-600" 
                placeholder="Title" 
                value={formData.title} 
                onChange={(e)=>setFormData(s=>({...s,title:e.target.value}))} 
                required 
              />
              <div>
                <label className="text-sm text-gray-700">Property</label>
                <select 
                  className="w-full border rounded px-3 py-2 mt-1 text-gray-900" 
                  value={formData.property_id} 
                  onChange={(e)=>setFormData(s=>({...s,property_id:e.target.value}))} 
                  required
                >
                  <option value="">Select property</option>
                  {/* TODO: Load owner properties */}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-700">Tenant</label>
                <select 
                  className="w-full border rounded px-3 py-2 mt-1 text-gray-900" 
                  value={formData.tenant_id} 
                  onChange={(e)=>setFormData(s=>({...s,tenant_id:e.target.value}))} 
                  required
                >
                  <option value="">Select tenant</option>
                  {/* TODO: Load available tenants */}
                </select>
              </div>
              <textarea 
                className="w-full border rounded px-3 py-2 text-gray-900 placeholder-gray-600" 
                placeholder="Description" 
                value={formData.description} 
                onChange={(e)=>setFormData(s=>({...s,description:e.target.value}))} 
                rows={3}
              />
              <div className="grid grid-cols-2 gap-3">
                <input 
                  className="w-full border rounded px-3 py-2 text-gray-900 placeholder-gray-600" 
                  placeholder="Monthly Rent" 
                  type="number" 
                  value={formData.monthly_rent} 
                  onChange={(e)=>setFormData(s=>({...s,monthly_rent:e.target.value}))} 
                  required 
                />
                <input 
                  className="w-full border rounded px-3 py-2 text-gray-900 placeholder-gray-600" 
                  placeholder="Security Deposit" 
                  type="number" 
                  value={formData.security_deposit} 
                  onChange={(e)=>setFormData(s=>({...s,security_deposit:e.target.value}))} 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input 
                  className="w-full border rounded px-3 py-2 text-gray-900" 
                  placeholder="Lease Start Date" 
                  type="date" 
                  value={formData.lease_start_date} 
                  onChange={(e)=>setFormData(s=>({...s,lease_start_date:e.target.value}))} 
                  required 
                />
                <input 
                  className="w-full border rounded px-3 py-2 text-gray-900" 
                  placeholder="Lease End Date" 
                  type="date" 
                  value={formData.lease_end_date} 
                  onChange={(e)=>setFormData(s=>({...s,lease_end_date:e.target.value}))} 
                  required 
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
                  {loading ? 'Creating...' : 'Create Tenancy Contract'}
                </button>
                <button type="button" onClick={() => setShowCreateTenancy(false)} className="px-4 py-2 border rounded">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

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
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              {typeOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              {priorityOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-')
                if (field && isSortField(field)) {
                  setSortBy(field)
                } else {
                  setSortBy('title')
                }
                setSortOrder(order as 'asc' | 'desc')
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              {sortOptions.map(option => (
                <React.Fragment key={option.value}>
                  <option value={`${option.value}-desc`}>{option.label} (Desc)</option>
                  <option value={`${option.value}-asc`}>{option.label} (Asc)</option>
                </React.Fragment>
              ))}
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
            {/* import missing earlier; replace with div icon fallback */}
            <div className="mx-auto h-12 w-12 text-gray-400">📄</div>
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
                  onClick={() => window.location.href = `/contracts?id=${contract.id}`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{contract.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <span>{contract.property?.title || 'No property'}</span>
                        <span>•</span>
                        <span>
                          {contract.contract_type === 'tenancy' 
                            ? contract.tenant?.full_name || 'Unknown tenant'
                            : contract.vendor?.full_name || 'Unknown vendor'
                          }
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {contract.notifications_count > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          {contract.notifications_count}
                        </span>
                      )}
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
                    {contract.contract_type !== 'tenancy' && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(contract.priority)}`}>
                        {contract.priority}
                      </span>
                    )}
                  </div>

                  {/* Contract Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">Value:</span>
                      <span className={`font-medium ${contract.contract_value ? 'text-gray-900' : 'text-gray-700'}`}>
                        {formatCurrency(contract.contract_value)}
                      </span>
                    </div>
                    
                    {contract.contract_type !== 'tenancy' && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-700">SLA:</span>
                        <span className="font-medium">{contract.sla_hours || 'Not set'}h</span>
                      </div>
                    )}

                    {contract.renewal_date && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-700">Renewal:</span>
                        <span className={`font-medium ${isRenewalSoon ? 'text-red-600' : 'text-gray-900'}`}>
                          {formatDate(contract.renewal_date)}
                          {isRenewalSoon && ` (${daysUntilRenewal} days)`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      {contract.documents_count > 0 && (
                        <span>{contract.documents_count} documents</span>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {contract.contract_type !== 'tenancy' && contract.vendor && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/dashboard/owner/contracts/${contract.id}/message?id=${contract.id}`)
                          }}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Message
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/dashboard/owner/contracts/${contract.id}/request-changes?id=${contract.id}`)
                        }}
                        className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                      >
                        Request Changes
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/dashboard/owner/contracts/${contract.id}/update-status?id=${contract.id}`)
                        }}
                        className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        Update Status
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      <BottomNavbar userRole="owner" />
    </div>
  )
}

export default function OwnerContractsPage() {
  return <OwnerContractsPageInner />
}


