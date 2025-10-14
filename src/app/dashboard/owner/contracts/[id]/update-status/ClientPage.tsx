'use client'

import React, { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'
import BottomNavbar from '@/components/BottomNavbar'

interface Contract {
  id: string
  title: string
  status: string
  contract_type: string
  contract_value: number | null
  start_date: string | null
  end_date: string | null
  renewal_date: string | null
  completion_date: string | null
  sla_hours: number | null
  vendor_notes: string | null
  owner_notes: string | null
  property: {
    id: string
    title: string
    address: string
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

export default function ClientPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const contractId = searchParams.get('id')

  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    new_status: '',
    notes: ''
  })
  const [message, setMessage] = useState('')

  const statusOptions = [
    { value: 'draft', label: 'Draft', description: 'Contract is in draft stage' },
    { value: 'pending_signatures', label: 'Pending Signatures', description: 'Waiting for signatures' },
    { value: 'active', label: 'Active', description: 'Contract is active and in progress' },
    { value: 'completed', label: 'Completed', description: 'Contract work is finished' },
    { value: 'terminated', label: 'Terminated', description: 'Contract has been terminated' },
    { value: 'expired', label: 'Expired', description: 'Contract has expired' }
  ]

  useEffect(() => {
    if (!contractId || !user?.id) return
    loadContract()
  }, [contractId, user?.id])

  const loadContract = async () => {
    try {
      setLoading(true)
      
      const { data: serviceContract } = await supabase
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
          sla_hours,
          vendor_notes,
          owner_notes,
          property:properties(id, title, address),
          vendor:profiles!service_contracts_vendor_id_fkey(id, full_name, email),
          tenant:profiles!service_contracts_tenant_id_fkey(id, full_name, email)
        `)
        .eq('id', contractId as string)
        .eq('owner_id', user!.id as string)
        .single()

      if (serviceContract) {
        setContract({
          ...serviceContract,
          contract_type: serviceContract.contract_type || 'maintenance'
        })
        setFormData(prev => ({ ...prev, new_status: serviceContract.status }))
        return
      }

      const { data: tenancyContract } = await supabase
        .from('tenancy_contracts')
        .select(`
          id,
          title,
          status,
          property:properties(id, title, address),
          tenant:profiles!tenancy_contracts_tenant_id_fkey(id, full_name, email)
        `)
        .eq('id', contractId as string)
        .eq('owner_id', user!.id as string)
        .single()

      if (tenancyContract) {
        setContract({
          ...tenancyContract,
          contract_type: 'tenancy',
          contract_value: null,
          start_date: null,
          end_date: null,
          renewal_date: null,
          completion_date: null,
          sla_hours: null,
          vendor_notes: null,
          owner_notes: null,
          vendor: null
        })
        setFormData(prev => ({ ...prev, new_status: tenancyContract.status }))
        return
      }

      setMessage('Contract not found or access denied')
    } catch (error) {
      console.error('Error loading contract:', error)
      setMessage('Error loading contract')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contract || !user || formData.new_status === contract.status) return

    try {
      setSubmitting(true)

      const updateData: any = { status: formData.new_status }
      if (formData.new_status === 'completed') {
        updateData.completion_date = new Date().toISOString()
      }

      const tableName = contract.contract_type === 'tenancy' ? 'tenancy_contracts' : 'service_contracts'
      const { error: updateError } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', contract.id)

      if (updateError) throw updateError

      if (contract.vendor?.id) {
        await supabase.rpc('create_contract_notification', {
          p_contract_id: contract.id,
          p_recipient_id: contract.vendor.id,
          p_notification_type: 'status_update',
          p_title: 'Contract Status Updated',
          p_message: `Contract "${contract.title}" status has been updated to ${formData.new_status.replace('_', ' ')}.`
        })
      }

      await supabase.rpc('log_contract_event', {
        p_contract_id: contract.id,
        p_event: 'status_updated',
        p_actor_id: user.id,
        p_old_values: { status: contract.status },
        p_new_values: { status: formData.new_status, notes: formData.notes }
      })

      setMessage('Contract status updated successfully')
      setFormData({ new_status: formData.new_status, notes: '' })
      loadContract()
    } catch (error) {
      console.error('Error updating contract status:', error)
      setMessage('Error updating contract status')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'Not specified'
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount)
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['owner']}>
        <div className="min-h-screen bg-gray-50">
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!contract) {
    return (
      <ProtectedRoute allowedRoles={['owner']}>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
              <h2 className="mt-4 text-lg font-medium text-gray-900">Contract Not Found</h2>
              <p className="mt-2 text-gray-600">{message}</p>
              <button
                onClick={() => router.back()}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Update Status</h1>
                <p className="text-sm text-gray-600">{contract.title}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6">
          {message && (
            <div className={`mb-6 p-4 rounded-lg border ${
              message.includes('Error') 
                ? 'bg-red-50 border-red-200 text-red-700' 
                : 'bg-green-50 border-green-200 text-green-700'
            }`}>
              {message}
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contract Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Property</p>
                <p className="font-medium text-gray-900">{contract.property?.title || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Contract Type</p>
                <p className="font-medium text-gray-900 capitalize">{contract.contract_type}</p>
              </div>
              {contract.vendor && (
                <div>
                  <p className="text-sm text-gray-600">Vendor</p>
                  <p className="font-medium text-gray-900">{contract.vendor.full_name}</p>
                </div>
              )}
              {contract.tenant && (
                <div>
                  <p className="text-sm text-gray-600">Tenant</p>
                  <p className="font-medium text-gray-900">{contract.tenant.full_name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Current Status</p>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(contract.status)}`}>
                  {contract.status.replace('_', ' ')}
                </span>
              </div>
              {contract.contract_value && (
                <div>
                  <p className="text-sm text-gray-600">Contract Value</p>
                  <p className="font-medium text-gray-900">{formatCurrency(contract.contract_value)}</p>
                </div>
              )}
              {contract.start_date && (
                <div>
                  <p className="text-sm text-gray-600">Start Date</p>
                  <p className="font-medium text-gray-900">{formatDate(contract.start_date)}</p>
                </div>
              )}
              {contract.end_date && (
                <div>
                  <p className="text-sm text-gray-600">End Date</p>
                  <p className="font-medium text-gray-900">{formatDate(contract.end_date)}</p>
                </div>
              )}
              {contract.completion_date && (
                <div>
                  <p className="text-sm text-gray-600">Completion Date</p>
                  <p className="font-medium text-gray-900">{formatDate(contract.completion_date)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Update Contract Status</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Status
                </label>
                <select
                  value={formData.new_status}
                  onChange={(e) => setFormData({ ...formData, new_status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  required
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value} className="text-gray-900">
                      {option.label} - {option.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-600"
                  placeholder="Add any notes about this status change..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting || formData.new_status === contract.status}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {submitting ? 'Updating...' : 'Update Status'}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-lg border border-gray-200">
            {/* Placeholder for future status history */}
          </div>
        </div>
        <BottomNavbar userRole="owner" />
      </div>
    </ProtectedRoute>
  )
}


