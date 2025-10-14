'use client'

import React, { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Send, AlertCircle } from 'lucide-react'
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
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    request_type: 'contract_terms',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent'
  })
  const [message, setMessage] = useState('')

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
          sla_hours: null,
          vendor_notes: null,
          owner_notes: null,
          vendor: null
        })
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

  const submitChangeRequest = async () => {
    if (!contract || !user?.id) return

    try {
      setSubmitting(true)

      if (contract.vendor?.id) {
        await supabase.rpc('create_contract_notification', {
          p_contract_id: contract.id,
          p_recipient_id: contract.vendor.id,
          p_notification_type: 'status_change',
          p_title: 'Change Request Submitted',
          p_message: `Owner has submitted a change request for contract: ${contract.title}`
        })
      }

      await supabase.rpc('log_contract_event', {
        p_contract_id: contract.id,
        p_event: 'change_request_submitted',
        p_actor_id: user.id,
        p_new_values: { change_request: formData }
      })

      setMessage('Change request submitted successfully')
      setShowForm(false)
      setFormData({
        title: '',
        description: '',
        request_type: 'contract_terms',
        priority: 'medium'
      })
    } catch (error) {
      console.error('Error submitting change request:', error)
      setMessage('Error submitting change request')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'implemented': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // removed unused formatDate

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
                <h1 className="text-xl font-semibold text-gray-900">Request Changes</h1>
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
                <p className="text-sm text-gray-600">Status</p>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(contract.status)}`}>
                  {contract.status.replace('_', ' ')}
                </span>
              </div>
              {contract.contract_value && (
                <div>
                  <p className="text-sm text-gray-600">Contract Value</p>
                  <p className="font-medium text-gray-900">
                    {new Intl.NumberFormat('en-ZA', {
                      style: 'currency',
                      currency: 'ZAR'
                    }).format(contract.contract_value)}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Change Requests</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              New Request
            </button>
          </div>

          {showForm && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Submit Change Request</h3>
              <form onSubmit={(e) => { e.preventDefault(); submitChangeRequest(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Request Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-600"
                    placeholder="Brief title for your change request"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Request Type
                  </label>
                  <select
                    value={formData.request_type}
                    onChange={(e) => setFormData({ ...formData, request_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  >
                    <option value="contract_terms" className="text-gray-900">Contract Terms</option>
                    <option value="pricing" className="text-gray-900">Pricing</option>
                    <option value="timeline" className="text-gray-900">Timeline</option>
                    <option value="scope" className="text-gray-900">Scope of Work</option>
                    <option value="other" className="text-gray-900">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  >
                    <option value="low" className="text-gray-900">Low</option>
                    <option value="medium" className="text-gray-900">Medium</option>
                    <option value="high" className="text-gray-900">High</option>
                    <option value="urgent" className="text-gray-900">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-600"
                    placeholder="Detailed description of the changes you're requesting..."
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200">
            {/* Placeholder for future change requests list */}
          </div>
        </div>
        <BottomNavbar userRole="owner" />
      </div>
    </ProtectedRoute>
  )
}


